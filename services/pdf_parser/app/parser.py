from __future__ import annotations

import io
import re
from datetime import datetime
from typing import Iterable

import pdfplumber

from .models import ParseResponse, ParsedTransaction, StatementSummary

try:
    import pypdfium2 as pdfium
    from PIL import Image
    from rapidocr_onnxruntime import RapidOCR
except ImportError:  # pragma: no cover - optional at runtime until dependencies are installed
    pdfium = None
    Image = None
    RapidOCR = None

DATE_RE = re.compile(r"^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$")
AMOUNT_RE = re.compile(r"^-?[\d,]+\.\d{2}$")
DATE_PREFIX_RE = re.compile(r"^(?P<date>\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(?P<rest>.+)$")
AMOUNT_FINDER_RE = re.compile(r"-?[\d,]+\.\d{2}")
DATE_NO_YEAR_RE = re.compile(r"^(?P<day>\d{1,2})\s?(?P<month>[A-Za-z]{3})$")
SIGNED_AMOUNT_RE = re.compile(r"^[+-]?[\d,]+\.\d{2}$")
FCY_AMOUNT_RE = re.compile(r"^[+-]?[\d,]+\.\d{2}\s+[A-Z]{3}$")
YEAR_RE = re.compile(r"\b(20\d{2})\b")
MONEY_TOKEN_RE = re.compile(r"S\$\s*([+-]?[\d,]+\.\d{2})")
HEADER_TOKENS = (
    "trust",
    "transactiondetails",
    "main account",
    "posting date",
    "description",
    "amount in fcy",
    "amount in sgd",
    "page ",
    "trust bank singapore limited",
    "gst reg no",
)
SKIP_DESCRIPTION_TOKENS = ("previous balance", "previousbalance", "closing balance", "closingbalance")
NOISE_LINE_PREFIXES = ("1USD=", "TRUST FX CHARGE")


def _normalize_date(value: str) -> str:
    return datetime.strptime(value.strip(), "%d %b %Y").date().isoformat()


def _normalize_amount(value: str) -> float:
    return float(value.replace(",", "").replace("S$", "").strip())


def _normalize_signed_amount(value: str) -> float:
    cleaned = value.replace(",", "")
    if cleaned.startswith("+"):
        return float(cleaned[1:])
    if cleaned.startswith("-"):
        return float(cleaned)
    return -float(cleaned)


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _is_header_line(value: str) -> bool:
    lowered = _clean_text(value).lower()
    return any(token in lowered for token in HEADER_TOKENS)


def _infer_statement_year(pdf_bytes: bytes) -> int:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text(x_tolerance=1.5, y_tolerance=3) or ""
            if match := YEAR_RE.search(text):
                return int(match.group(1))

    if pdfium is not None and RapidOCR is not None:
        engine = RapidOCR()
        pdf = pdfium.PdfDocument(io.BytesIO(pdf_bytes))
        first_page = pdf[0]
        image = first_page.render(scale=2.5).to_pil()
        result, _ = engine(image)
        for item in result or []:
            if match := YEAR_RE.search(item[1]):
                return int(match.group(1))

    return datetime.utcnow().year


def _rows_from_line(line: str) -> ParsedTransaction | None:
    match = DATE_PREFIX_RE.match(_clean_text(line))
    if not match:
        return None

    amounts = list(AMOUNT_FINDER_RE.finditer(match.group("rest")))
    if not amounts:
        return None

    rest = match.group("rest")
    amount_index = len(amounts) - 1
    balance = None

    if len(amounts) >= 2:
        amount_index = len(amounts) - 2
        balance = _normalize_amount(amounts[-1].group())

    amount_match = amounts[amount_index]
    description = _clean_text(rest[: amount_match.start()])

    if not description:
        return None

    amount = _normalize_amount(amount_match.group())

    return ParsedTransaction(
        date=_normalize_date(match.group("date")),
        description=description,
        amount=amount,
        balance=balance,
    )


def _dedupe_transactions(transactions: Iterable[ParsedTransaction]) -> list[ParsedTransaction]:
    deduped: list[ParsedTransaction] = []
    seen: set[tuple[str, str, float, float | None]] = set()

    for transaction in transactions:
        key = (
            transaction.date,
            transaction.description,
            transaction.amount,
            transaction.balance,
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(transaction)

    return deduped


def _money_from_line(value: str) -> float | None:
    if match := MONEY_TOKEN_RE.search(value):
        return _normalize_amount(match.group(1))
    if SIGNED_AMOUNT_RE.match(value):
        return _normalize_amount(value)
    return None


def _extract_summary(pdf_bytes: bytes) -> StatementSummary | None:
    summary_lines: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        first_page_text = pdf.pages[0].extract_text(x_tolerance=1.5, y_tolerance=3) or ""
        summary_lines = [_clean_text(line) for line in first_page_text.splitlines() if _clean_text(line)]

    values = [_money_from_line(line) for line in summary_lines]
    money_values = [value for value in values if value is not None]

    if len(money_values) < 5 and pdfium is not None and RapidOCR is not None:
        engine = RapidOCR()
        pdf = pdfium.PdfDocument(io.BytesIO(pdf_bytes))
        image = pdf[0].render(scale=2.5).to_pil()
        result, _ = engine(image)
        summary_lines = [_clean_text(item[1]) for item in result or [] if _clean_text(item[1])]
        values = [_money_from_line(line) for line in summary_lines]
        money_values = [value for value in values if value is not None]

    if len(money_values) < 5:
        return None

    # Trust's summary table order is opening, incoming, outgoing, interest, closing.
    opening_balance, total_incoming, total_outgoing, interest, closing_balance = money_values[:5]

    return StatementSummary(
        opening_balance=opening_balance,
        total_incoming=total_incoming,
        total_outgoing=total_outgoing,
        interest=interest,
        closing_balance=closing_balance,
    )


def _apply_running_balances(
    transactions: list[ParsedTransaction], summary: StatementSummary | None
) -> list[ParsedTransaction]:
    if not transactions or summary is None or summary.opening_balance is None:
        return transactions

    running_balance = summary.opening_balance
    with_balances: list[ParsedTransaction] = []

    for transaction in transactions:
        running_balance += transaction.amount
        with_balances.append(
            transaction.model_copy(
                update={"balance": round(running_balance, 2) if transaction.balance is None else transaction.balance}
            )
        )

    return with_balances


def _derive_insights(summary: StatementSummary | None, transactions: list[ParsedTransaction]) -> list[str]:
    if summary is None:
        return []

    insights: list[str] = []

    if (
        summary.total_incoming is not None
        and summary.total_outgoing is not None
        and summary.closing_balance is not None
        and summary.opening_balance is not None
    ):
        net_flow = round(summary.total_incoming - summary.total_outgoing, 2)
        change = round(summary.closing_balance - summary.opening_balance, 2)
        direction = "more" if net_flow < 0 else "less"
        insights.append(
            f"Net cash flow was S${abs(net_flow):.2f} {direction} than income this period."
        )
        insights.append(
            f"Closing balance moved by S${change:.2f} from the opening balance."
        )

    if summary.interest is not None:
        insights.append(f"Interest earned this statement period was S${summary.interest:.2f}.")

    if transactions:
        biggest_spend = min((txn for txn in transactions if txn.amount < 0), default=None, key=lambda txn: txn.amount)
        biggest_inflow = max((txn for txn in transactions if txn.amount > 0), default=None, key=lambda txn: txn.amount)

        if biggest_spend is not None:
            insights.append(
                f"Largest outgoing transaction: {biggest_spend.description} for S${abs(biggest_spend.amount):.2f} on {biggest_spend.date}."
            )
        if biggest_inflow is not None:
            insights.append(
                f"Largest incoming transaction: {biggest_inflow.description} for S${biggest_inflow.amount:.2f} on {biggest_inflow.date}."
            )

    return insights


def _extract_table_rows(pdf_bytes: bytes) -> tuple[list[ParsedTransaction], list[str]]:
    transactions: list[ParsedTransaction] = []
    warnings: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables() or []
            for table in tables:
                for row in table:
                    cleaned = [cell.strip() if cell else "" for cell in row]
                    if len(cleaned) < 3:
                        continue

                    date, description = cleaned[0], cleaned[1]
                    amount_cell = next((cell for cell in reversed(cleaned) if AMOUNT_RE.match(cell)), "")

                    if not DATE_RE.match(date) or not amount_cell:
                        continue

                    balance = None
                    if len(cleaned) >= 4 and AMOUNT_RE.match(cleaned[-1]) and cleaned[-1] != amount_cell:
                        balance = _normalize_amount(cleaned[-1])

                    transactions.append(
                        ParsedTransaction(
                            date=_normalize_date(date),
                            description=description,
                            amount=_normalize_amount(amount_cell),
                            balance=balance,
                        )
                    )

            if not tables:
                warnings.append(f"No tables found on page {page_number}")

    return transactions, warnings


def _extract_text_rows(pdf_bytes: bytes) -> tuple[list[ParsedTransaction], list[str]]:
    transactions: list[ParsedTransaction] = []
    warnings: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=1.5, y_tolerance=3) or ""
            page_rows = [parsed for line in text.splitlines() if (parsed := _rows_from_line(line))]

            if page_rows:
                transactions.extend(page_rows)
            else:
                warnings.append(f"No text rows detected on page {page_number}")

    return _dedupe_transactions(transactions), warnings


def _extract_ocr_rows(pdf_bytes: bytes) -> tuple[list[ParsedTransaction], list[str]]:
    if pdfium is None or Image is None or RapidOCR is None:
        return [], ["OCR dependencies are not installed for rendered PDF fallback"]

    warnings: list[str] = []
    transactions: list[ParsedTransaction] = []
    engine = RapidOCR()
    pdf = pdfium.PdfDocument(io.BytesIO(pdf_bytes))
    statement_year = _infer_statement_year(pdf_bytes)

    for page_number in range(len(pdf)):
        page = pdf[page_number]
        bitmap = page.render(scale=2.5).to_pil()

        if not isinstance(bitmap, Image.Image):
            warnings.append(f"OCR render failed on page {page_number + 1}")
            continue

        result, _ = engine(bitmap)
        if not result:
            warnings.append(f"OCR found no text on page {page_number + 1}")
            continue

        lines = [_clean_text(item[1]) for item in result if item and len(item) >= 2]
        page_rows = _extract_ocr_page_rows(lines, statement_year)

        if page_rows:
            transactions.extend(page_rows)
        else:
            warnings.append(f"OCR found text but no transaction rows on page {page_number + 1}")

    return _dedupe_transactions(transactions), warnings


def _extract_ocr_page_rows(lines: list[str], year: int) -> list[ParsedTransaction]:
    rows: list[ParsedTransaction] = []
    index = 0

    while index < len(lines):
        line = _clean_text(lines[index])

        if not line or _is_header_line(line):
            index += 1
            continue

        date_match = DATE_NO_YEAR_RE.match(line)
        if not date_match:
            index += 1
            continue

        date_value = f"{date_match.group('day')} {date_match.group('month')} {year}"
        index += 1

        payload: list[str] = []
        while index < len(lines):
            candidate = _clean_text(lines[index])
            if not candidate:
                index += 1
                continue
            if _is_header_line(candidate) or DATE_NO_YEAR_RE.match(candidate):
                break
            payload.append(candidate)
            index += 1

        if not payload:
            continue

        description = payload[0]
        normalized_description = description.lower().replace(" ", "")
        if description.lower() in SKIP_DESCRIPTION_TOKENS or normalized_description in SKIP_DESCRIPTION_TOKENS:
            continue

        amount_candidates = [value for value in payload[1:] if SIGNED_AMOUNT_RE.match(value)]
        if not amount_candidates:
            amount_candidates = [value for value in payload[1:] if FCY_AMOUNT_RE.match(value)]

        if not amount_candidates and SIGNED_AMOUNT_RE.match(payload[-1]):
            amount_candidates = [payload[-1]]

        if not amount_candidates:
            continue

        balance = None
        amount_raw = amount_candidates[-1]

        if FCY_AMOUNT_RE.match(amount_raw):
            amount_raw = next(
                (value for value in reversed(payload) if SIGNED_AMOUNT_RE.match(value)),
                "",
            )
            if not amount_raw:
                continue

        if len(amount_candidates) >= 2 and SIGNED_AMOUNT_RE.match(amount_candidates[-1]):
            balance = _normalize_amount(amount_candidates[-1])
            amount_raw = amount_candidates[-2]

        if any(payload_line.startswith(prefix) for prefix in NOISE_LINE_PREFIXES for payload_line in payload):
            balance = balance

        rows.append(
            ParsedTransaction(
                date=_normalize_date(date_value),
                description=description,
                amount=_normalize_signed_amount(amount_raw),
                balance=balance,
            )
        )

    return rows


def parse_statement(pdf_bytes: bytes) -> ParseResponse:
    summary = _extract_summary(pdf_bytes)
    transactions, warnings = _extract_table_rows(pdf_bytes)

    if transactions:
        deduped = _apply_running_balances(_dedupe_transactions(transactions), summary)
        return ParseResponse(
            transactions=deduped,
            summary=summary,
            insights=_derive_insights(summary, deduped),
            warnings=warnings,
        )

    text_transactions, text_warnings = _extract_text_rows(pdf_bytes)
    warnings.extend(text_warnings)

    if text_transactions:
        warnings.append("Parsed with text extraction fallback")
        with_balances = _apply_running_balances(text_transactions, summary)
        return ParseResponse(
            transactions=with_balances,
            summary=summary,
            insights=_derive_insights(summary, with_balances),
            warnings=warnings,
        )

    ocr_transactions, ocr_warnings = _extract_ocr_rows(pdf_bytes)
    warnings.extend(ocr_warnings)

    if ocr_transactions:
        warnings.append("Parsed with OCR fallback")
        with_balances = _apply_running_balances(ocr_transactions, summary)
        return ParseResponse(
            transactions=with_balances,
            summary=summary,
            insights=_derive_insights(summary, with_balances),
            warnings=warnings,
        )

    return ParseResponse(
        transactions=[],
        summary=summary,
        insights=_derive_insights(summary, []),
        warnings=warnings + ["No transactions extracted from PDF"],
    )
