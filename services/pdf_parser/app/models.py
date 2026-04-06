from pydantic import BaseModel


class ParsedTransaction(BaseModel):
    date: str
    description: str
    amount: float
    balance: float | None = None
    currency: str = "SGD"
    category: str | None = None


class StatementSummary(BaseModel):
    opening_balance: float | None = None
    total_incoming: float | None = None
    total_outgoing: float | None = None
    interest: float | None = None
    closing_balance: float | None = None


class ParseResponse(BaseModel):
    institution: str = "Trust Bank"
    account_name: str | None = None
    transactions: list[ParsedTransaction]
    summary: StatementSummary | None = None
    insights: list[str] = []
    warnings: list[str] = []
