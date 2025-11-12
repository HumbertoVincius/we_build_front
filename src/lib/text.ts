export function decodeEscapedString(input: string): string {
  if (!input.includes("\\")) {
    return input;
  }

  let decoded = input;

  decoded = decoded.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  decoded = decoded.replace(/\\t/g, "\t");
  decoded = decoded.replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  decoded = decoded.replace(/\\"/g, '"').replace(/\\'/g, "'");
  decoded = decoded.replace(/\\\\/g, "\\");

  return decoded;
}
