import type { Problema } from "@/lib/boot";

/**
 * Mostra o que a verificação de boot encontrou.
 *
 * Erro fica em vermelho porque emitir com o banco nesse estado produz código torto, e
 * código não se edita depois. Aviso é amarelo: incomoda, mas não impede emitir.
 */
export function AvisosIntegridade({ problemas }: { problemas: Problema[] }) {
  if (problemas.length === 0) return null;

  const erros = problemas.filter((p) => p.nivel === "erro");
  const avisos = problemas.filter((p) => p.nivel === "aviso");

  return (
    <div className="space-y-3">
      {erros.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          <p className="font-semibold">
            {erros.length} problema{erros.length > 1 ? "s" : ""} de integridade no
            banco
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {erros.map((p, i) => (
              <li key={i}>{p.mensagem}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Resolva antes de emitir: código emitido não pode ser corrigido depois.
          </p>
        </div>
      )}

      {avisos.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <ul className="list-disc space-y-1 pl-5">
            {avisos.map((p, i) => (
              <li key={i}>{p.mensagem}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
