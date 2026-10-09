function normalizeColor(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  if (/^#[\da-f]{6}$/i.test(value)) return value;
  if (/^#[\da-f]{3}$/i.test(value)) return `#${value.slice(1).split("").map((digit) => digit.repeat(2)).join("")}`;
  return fallback;
}

function foregroundColor(background: string) {
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(background.slice(offset, offset + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  const darkContrast = (luminance + .05) / .0592;
  const lightContrast = 1.05 / (luminance + .05);
  if (darkContrast >= 4.5) return "#111827";
  return lightContrast >= 4.5 ? "#FFFFFF" : "#000000";
}

export function getCompanyHubTheme(branding?: Record<string, string>) {
  const primary = normalizeColor(branding?.primary_color, "#135BCA");
  const accent = normalizeColor(branding?.accent_color, "#24824F");
  return {
    "--hub-primary": primary,
    "--hub-accent": accent,
    "--hub-on-primary": foregroundColor(primary),
    "--hub-on-accent": foregroundColor(accent),
  };
}
