// Module de révision maths pour l'examen du Jury CESS général.
// Le contenu est une page autonome (public/maths.html) : formules MathJax,
// graphiques SVG et progression sauvegardée en localStorage (même origine que l'appli).
export function MathsJury() {
  return (
    <iframe
      src="/maths.html"
      title="Maths Jury CESS"
      className="block w-full border-0"
      style={{ height: 'calc(100vh - 110px)' }}
    />
  )
}
