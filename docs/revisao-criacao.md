# Revisão da criação de personagens

Comparação feita em 12/09/2026 com os arquivos locais **Ordem-Paranormal-v1-1.pdf**
e **sobrevivendo-ao-horror-v1-2.pdf**. As referências abaixo usam a página impressa.
O básico é digitalizado: as páginas relevantes foram renderizadas e conferidas
visualmente. O suplemento tem texto extraível. Esta revisão cobre as regras de
montagem e evolução relacionadas às alterações, não é uma certificação integral
dos livros ou de todas as combinações possíveis.

## Comparação e alterações

| Área | Situação encontrada | Implementação | Fonte |
| --- | --- | --- | --- |
| Origens | 33 nomes misturavam origens oficiais, nomes incorretos e aproximações de poderes | 26 origens do básico + 20 do suplemento, resumos revisados e referência por origem. Nomes antigos já salvos continuam editáveis como personalizados | Básico 16–21; Horror 7–13 |
| Perícias iniciais | Contagem sem exigir as escolhas de origem/classe; Ocultismo e Vontade tratados como alternativas | Perícias fixas marcadas e bloqueadas; escolhas obrigatórias validadas; duplicatas entre fontes permitem escolhas adicionais sem aumentar treino para +10 | Básico 16, 25, 29, 33 |
| Atributos | A troca de classe podia aceitar orçamento excedido e impedir corrigir a distribuição | Orçamento validado em ambas as direções; permite retirar pontos quando a nova classe tem menos pontos | Básico 14; Horror 30 |
| Habilidades iniciais | Não eram gravadas na criação | Poder da origem, Ataque Especial, Eclético/Perito, Escolhido pelo Outro Lado ou Empenho são registrados, conforme classe | Básico 24, 28, 32, 172; Horror 31 |
| Perito | Nenhuma escolha orientada | Exige duas perícias treinadas distintas, exceto Luta e Pontaria | Básico 28 |
| Ocultista | Sem seleção inicial de rituais; círculos em NEX incorreto | Solicita os três nomes e elementos; acesso aos círculos em 5/25/55/85%, com custo 1/3/6/10 PE. Campos dos efeitos continuam manuais | Básico 32 |
| NEX 99% | Calculado como o mesmo nível de 95% | Corresponde ao vigésimo patamar; avanço preserva danos e bônus manuais existentes | Básico 23, 25, 29, 33 |
| Sobrevivente | Progressão de Especialista por NEX | NEX 0%, estágios 1–5, PV 8+VIG, PE 2+PRE, SAN 8; ganhos fixos 2/1/2. Avanço guiado com trilha, atributo, perícia, segundo poder e Cicatrizado | Horror 30–32 |
| Mundano | Marcado como caseiro, estatísticas incorretas | Classe opcional oficial: três pontos de atributo, 1+INT perícias, PV 8+VIG, PE 1+PRE, SAN 8, Empenho | Básico 171–172 |
| Bônus de origem | Resumos divergiam dos efeitos oficiais; criação ignorava bônus | Status incluem Desgarrado, Vítima, Universitário, Mergulhador e redução inicial do Cultista. Criação inclui Defesa do Policial, bônus de Diplomata/Profetizado e anota resistências pertinentes | Básico 18–21; Horror 9, 12–13 |
| Equipamento | Fora do assistente e sem preenchimento de limites | Catálogo no assistente; patente/crédito, carga por FOR (FOR 0 = 2 espaços), limites por categoria e regra de civis | Básico 52–53; Horror 31 |
| Trilhas | Não havia campo próprio | Seleção por classe com resumos e fontes, incluindo trilhas do suplemento; habilidades de agentes permanecem editáveis | Básico 26–35; Horror 15–32 |
| Iniciantes | Dicas com conceitos incorretos e sem roteiro de conferência | Guia de testes, recursos, origem, proficiências, evolução e pendências; SAN 0 explicado como enlouquecendo; limite de PE identificado por turno | Básico 23 e regras de insanidade |
| Painéis | Ordem fixa e sempre abertos | Arraste, setas, recolher/expandir, ocultar/mostrar, cascata, restauração e persistência local | Interface |

## Como usar

1. Em **Novo personagem → Passo a passo**, escolha origem e classe, distribua
   atributos e complete as perícias. Escolhas fixas já vêm marcadas.
2. Registre as escolhas de poderes e selecione equipamento. Pode deixar o
   equipamento para depois; o guia mostrará a pendência.
3. Na ficha, use **Opção de visibilidade** e os controles dos títulos. Ocultar
   não apaga nada; para recuperar, abra **Mostrar ou ocultar painéis**.
4. Abra o **Guia do personagem** e use **Atualizar conferência** depois de
   preencher dados. Agentes evoluem com **Subir NEX**; Sobreviventes usam
   **Subir estágio**. O assistente cria a ficha inicial; avanços exigem suas
   escolhas adicionais.

## Limites da automação

- A lista de trilhas é orientativa. Para agentes, selecionar o nome não cria
  todos os poderes nem aplica seus modificadores. Os poderes de classe,
  poderes paranormais, afinidade, versatilidade e requisitos ainda precisam de
  revisão e registro em Habilidades. Transcender altera ganhos de SAN e requer
  ajuste manual. Cálculos gerais não reconstroem o histórico desses poderes.
- Os nomes dos rituais são digitados pelo jogador; não há catálogo completo de
  rituais nem validação de que cada nome pertence ao círculo informado. Execução,
  alcance, efeitos, aprimoramentos e condições de conjuração são preenchidos
  na ficha. O aviso de círculo aplica-se a Ocultistas, não a outras formas de
  aprender rituais.
- Efeitos condicionais de origem não são executados automaticamente durante
  rolagens. Escolhas como arma de Operário, poder paranormal do Cultista e
  companheiro animal ficam registradas para completar os campos correspondentes.
  Profissão continua sendo uma perícia genérica; múltiplas especializações
  independentes não são modeladas.
- O catálogo existente reúne também Arquivos Secretos. Equipamentos selecionados
  no assistente preenchem o inventário; os ataques, proteção, proficiência e
  descontos especiais de categoria ainda precisam de conferência na ficha.
- Separação de nível/NEX (Horror 98), Determinação substituindo PE/SAN (104),
  criação por idade (Básico 172), ferimentos debilitantes e outras variantes
  exigem acordo da mesa e tratamento manual. O guia não confunde essas variantes
  com os cálculos padrão. A interface preexistente de idade foi preservada.
- Mudança de Mundano/Sobrevivente para agente tem regras próprias de treinamento
  e não é feita pelo botão de evolução. Alterar o nome da classe não reconstrói
  automaticamente esses benefícios ou a história do personagem.
- Fichas antigas não têm seus valores migrados silenciosamente. Recalcular status
  é uma ação explícita. Efeitos antes anotados à mão podem já estar nos máximos;
  confira o resumo antes de aplicar um recálculo. Avanços por NEX/estágio somam
  diferenças, preservando bônus manuais e danos.
- Organização de painéis é salva neste navegador por usuário/personagem; não
  sincroniza entre aparelhos. O modo cascata usa recuos no desktop e uma coluna
  no celular. Impressão mostra o conteúdo dos painéis mesmo quando recolhidos.

## Validação

- `node tests/regras.test.cjs`: fórmulas iniciais, NEX 95→99, estágios,
  Mundano, bônus de origem, perícias fixas, carga, patente, idade e ficha legada.
- `tests/interface.cjs`: criação com dados fictícios, bloqueio de perícias
  inválidas, equipamento, controles de painéis, persistência na reabertura,
  arraste, foco e dica, viewport de 390 px, leitura sem edição e evolução.
- Teste em Chrome isolado, sem servidor e com rede interceptada: nenhum dado
  real de conta, campanha ou Supabase foi criado/alterado durante os testes.
- Integração real de autenticação, gravação e realtime do Supabase não foi
  exercitada. As novas propriedades usam o objeto JSON de personagem existente,
  sem migração SQL.
