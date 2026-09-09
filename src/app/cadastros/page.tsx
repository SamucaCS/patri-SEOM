import { TabelaClasses } from "./_components/tabela-classes";
import { TabelaEscolas } from "./_components/tabela-escolas";
import {
  listarClassesParaCadastro,
  listarEscolasParaCadastro,
} from "@/lib/cadastros";

export const dynamic = "force-dynamic";

export default async function PaginaCadastros() {
  const [escolas, classes] = await Promise.all([
    listarEscolasParaCadastro(),
    listarClassesParaCadastro(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Cadastros</h2>
        <p className="mt-1 text-sm text-slate-600">
          A sigla fica somente leitura assim que a unidade emite o primeiro código: ela
          já está impressa em campo. O nome continua editável. Para tirar de circulação
          sem apagar histórico, desmarque “Ativa”.
        </p>
      </div>

      <TabelaEscolas escolas={escolas} />
      <TabelaClasses classes={classes} />
    </div>
  );
}
