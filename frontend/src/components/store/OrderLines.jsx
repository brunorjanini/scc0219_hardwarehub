import "./OrderLines.css";
import { formatPrice } from "../../utils/format";

// Items and total of an order (checkout summary and confirmation page).
// `lines` are [{ productId, name, price, quantity }].
export default function OrderLines({ lines, total, caption = "Itens do pedido" }) {
  return (
    <table className="order-lines">
      <caption className="visually-hidden">{caption}</caption>
      <thead className="visually-hidden">
        <tr>
          <th scope="col">Produto</th>
          <th scope="col">Quantidade</th>
          <th scope="col">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.productId}>
            <th scope="row" className="order-lines-name">
              {line.name}
            </th>
            <td className="order-lines-quantity">{line.quantity}×</td>
            <td className="order-lines-price">{formatPrice(line.price * line.quantity)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colSpan={2}>
            Total
          </th>
          <td className="order-lines-price">{formatPrice(total)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
