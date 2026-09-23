# Fixtures de teste

Gerados por [`scripts/make-fixtures.ts`](../../scripts/make-fixtures.ts) (`npx tsx scripts/make-fixtures.ts`). São commitados — não regenerados a cada `npm test`. Descrição de cada um em [docs/09-testes-e-qualidade.md §3](../../docs/09-testes-e-qualidade.md#3-fixtures).

## Faltando: `simple-rar4.cbr` e `simple-rar5.cbr`

A doc pede esses dois arquivos RAR de verdade, mas criar um RAR exige a ferramenta proprietária `rar` (WinRAR/RARLab) ou o `unrar` com suporte a criação — nenhum dos dois está disponível no ambiente onde este projeto foi desenvolvido. `node-unrar-js` só **lê** RAR (é um decoder WASM), não cria.

**Para adicionar esses fixtures**, numa máquina com o `rar` instalado:

```bash
mkdir /tmp/rar-fixture && cd /tmp/rar-fixture
# copie 3 imagens quaisquer como 01.jpg, 02.jpg, 03.jpg
rar a -ma4 simple-rar4.cbr 01.jpg 02.jpg 03.jpg   # força o formato RAR4
rar a -ma5 simple-rar5.cbr 01.jpg 02.jpg 03.jpg   # força o formato RAR5 (default)
cp simple-rar4.cbr simple-rar5.cbr tests/fixtures/
```

Até lá, os testes de `RarArchive` que dependem desses arquivos ficam marcados como pulados (`it.skipIf`), com um comentário apontando para este README — eles não travam o `npm test`, mas também não cobrem o parser RAR de verdade. A detecção de formato (`detect.ts`) e a estrutura da classe são testadas independentemente disso.
