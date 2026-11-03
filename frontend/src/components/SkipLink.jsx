// "Pular para o conteúdo": first element of every layout. Hidden until it
// gets keyboard focus; jumps over the header and menus to the <main>
// with id `targetId` (which needs tabIndex={-1} to receive focus).
export default function SkipLink({ targetId = "conteudo" }) {
  function handleClick(e) {
    e.preventDefault();
    const target = document.getElementById(targetId);
    target?.focus();
    target?.scrollIntoView?.({ block: "start" });
  }

  return (
    <a href={`#${targetId}`} className="skip-link" onClick={handleClick}>
      Pular para o conteúdo
    </a>
  );
}
