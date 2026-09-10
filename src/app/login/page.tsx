import { FormularioLogin } from "./formulario-login";

export const metadata = { title: "Entrar — Emissor de Patrimônio" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string }>;
}) {
  const { proximo } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          Emissor de Códigos de Patrimônio
        </h1>
        <p className="mt-1 text-sm text-slate-600">SEOM / URE Suzano</p>
      </div>

      <FormularioLogin proximo={proximo ?? "/"} />

      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        O acesso é criado pela equipe do SEOM. Não há cadastro nesta tela — se você
        precisa de acesso, peça a quem administra o sistema.
      </p>
    </div>
  );
}
