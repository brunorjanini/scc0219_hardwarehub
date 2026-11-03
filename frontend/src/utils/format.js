// Number formatting in Brazilian Portuguese

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// 4299.9 -> "R$ 4.299,90"
export function formatPrice(value) {
  return currency.format(Number(value) || 0);
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
});

// ISO date -> "3 de novembro de 2026 às 14:35"
export function formatDateTime(isoDate) {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? "" : dateTime.format(date);
}

// Address object -> one line
export function formatAddress(address) {
  if (!address) return "";
  const { street, number, city, zip } = address;
  return `${street}, ${number} – ${city} – CEP ${zip}`;
}

// 4.2 -> "4,2"
export function formatNumber(value) {
  return Number(value).toLocaleString("pt-BR");
}
