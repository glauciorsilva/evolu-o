// Banco PÚBLICO: arquivos JSON versionados no GitHub (pasta dados-publicos/).
// Qualquer pessoa pode ler; mudanças entram por commit/pull request.

const cache = new Map();

export async function carregarPublico(nome) {
  if (!cache.has(nome)) {
    cache.set(nome, fetch(new URL(`../../dados-publicos/${nome}.json`, import.meta.url)).then((r) => {
      if (!r.ok) throw new Error(`Não foi possível carregar ${nome}.json (${r.status}).`);
      return r.json();
    }));
  }
  return cache.get(nome);
}
