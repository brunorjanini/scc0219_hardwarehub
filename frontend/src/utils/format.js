// Number formatting in Brazilian Portuguese

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// 4299.9 -> "R$ 4.299,90"
export function formatPrice(value) {
  return currency.format(Number(value) || 0);
}

// 4.2 -> "4,2"
export function formatNumber(value) {
  return Number(value).toLocaleString("pt-BR");
}
