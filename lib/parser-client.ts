export async function forwardPdfToParser(file: File) {
  const parserUrl = process.env.PARSER_SERVICE_URL;

  if (!parserUrl) {
    throw new Error("Missing PARSER_SERVICE_URL");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${parserUrl}/parse`, {
    method: "POST",
    body: formData,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Parser request failed with ${response.status}`);
  }

  return response.json();
}
