import { FormularioEmissao } from "./_components/formulario-emissao";
import { listarClassesAtivas, listarEscolasAtivas } from "@/lib/consultas";

// O sequencial depende do que já foi gravado: a tela nunca pode vir de cache.
export const dynamic = "force-dynamic";

export default async function PaginaEmissao() {
  const [escolas, classes] = await Promise.all([
    listarEscolasAtivas(),
    listarClassesAtivas(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Emitir códigos</h2>
        <p className="mt-1 text-sm text-slate-600">
          O sequencial é próprio de cada escola, classe e ano, e reinicia em 1 a cada
          ano. Código emitido nunca é reaproveitado.
        </p>
      </div>

      <FormularioEmissao
        escolas={escolas}
        classes={classes}
        ano={new Date().getFullYear()}
      />
    </div>
  );
}
