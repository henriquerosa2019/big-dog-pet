# Documentação Técnica e Operacional: Curva ABC de Clientes & Sinalização Inteligente em Tempo Real

## 📌 Visão Geral e Propósito

Esta funcionalidade implementa o pilar estratégico de **Gestão e Relacionamento com Clientes (CRM Inteligente)** no Petshop Big Dog Pet Franco da Rocha. O sistema não apenas analisa retroativamente a base de clientes através de 4 dashboards executivos, como também **atua em tempo real na rotina operacional**, sinalizando instantaneamente a importância de cada tutor no momento em que ele faz um agendamento ou uma compra na loja virtual.

---

## 1. Metodologia de Cálculo da Curva ABC de Tutores

A classificação da Curva ABC baseia-se no princípio de Pareto (regra 70/20/10), cruzando todo o faturamento histórico e do período gerado por cada cliente nas tabelas `appointments` (serviços executados e taxas de transporte leva-e-traz) e `orders` (pedidos entregues na loja virtual), vinculado aos `profiles` e `pets`:

1. **💎 Classe A (Tutores VIPs - até 70% do faturamento)**:
   - Representam a minoria da base (geralmente entre 15% e 20% dos clientes), mas respondem pela maior fatia da receita do petshop.
   - Apresentam o maior faturamento total acumulado e alta frequência de visitas.
2. **📈 Classe B (Tutores Regulares - 70% a 90% do faturamento acumulado)**:
   - Clientes fiéis com frequência consistente (cerca de 25% a 30% da base), com grande potencial de aumento de ticket médio e migração para a Classe A através de pacotes mensais e vendas combinadas de serviços e produtos.
3. **🎯 Classe C (Esporádicos e Novos - 90% a 100% do faturamento acumulado)**:
   - Representam a maior quantidade de cadastros (cerca de 50% da base), mas com visitas raras ou compras únicas. O foco é a fidelização automatizada (lembretes de vacina, retornos e cartão fidelidade).

---

## 2. Os 4 Dashboards Executivos (Aba "Relatórios" -> "Curva ABC - Clientes")

O módulo acessível em `Relatórios > 👥 Curva ABC - Clientes` disponibiliza 4 visões gerenciais fundamentais:

### 📊 Dashboard 1 · Distribuição Pareto e Gasto Médio da Base
* **Barra Contínua de Pareto**: Visualização proporcional em tempo real do faturamento distribuído entre as classes A (verde esmeralda), B (azul) e C (âmbar).
* **3 Cards Executivos**:
  - Exibição de Faturamento Total (R$), Quantidade de Tutores, % de Participação na Base e Gasto Médio por cliente.
  - Box de Recomendação de Gestão estratégica para cada classe.
* **Tag de Índice Pareto**: Indicador dinâmico de concentração (ex: *"71% da receita gerada por 18% dos tutores"*).

### 🏆 Dashboard 2 · Ranking Top Tutores VIPs (Classe A)
* Lista dos maiores tutores da loja ordenados pelo faturamento acumulado.
* Exibição de: Nome, Pets vinculados com ícone de patinha, quantidade de atendimentos e compras.
* **Atalho WhatsApp VIP**: Disparo com 1 clique de mensagem carinhosa agradecendo a preferência e parceria.

### 🚨 Dashboard 3 · Radar de Frequência & Retenção de Clientes
* Classificação em tempo real dos clientes pelo tempo desde a última atividade:
  - 🟢 **Ativos (< 30 dias)**: Frequência regular e saudável.
  - 🟡 **Em Alerta (30 a 60 dias)**: Ponto de contato ideal para convite de retorno ou lembrete de tosa.
  - 🔴 **Em Risco de Abandono (> 60 dias)**: Clientes afastados com perigo de interrupção ou migração.
* **Alerta Crítico de VIPs**: Notificação expressa caso tutores da Classe A estejam há mais de 30 dias sem visita para resgate preventivo imediato.

### 🛒 Dashboard 4 · Perfil de Consumo & Oportunidade de Vendas Combinadas (Serviços + Loja)
* Divisão analítica da base:
  - 🟣 **Híbridos (Serviço + Loja)**: Tutores que fazem banho/tosa e compram na loja (maior gasto médio da base).
  - 🔵 **Apenas Serviços**: Fiéis à estética animal com oportunidade de compra de petiscos e rações na entrega.
  - 🟠 **Apenas Loja Virtual**: Compradores de balcão ou e-commerce com oportunidade de conversão para banho através de cupons de primeiro agendamento.

### 📋 Tabela Analítica & Exportação Excel (.xlsx)
* Tabela completa com paginação e busca por nome do tutor, pet ou telefone.
* Filtros rápidos de Classe (Todas, A, B, C), Perfil de Consumo e Status de Retenção.
* Exportação em planilha Excel formatada contendo:
  - **Aba 1 (Resumo Executivo)**: Totais, faturamentos, gasto médio, radar de retenção e perfis.
  - **Aba 2 (Curva ABC Clientes)**: Lista analítica detalhada linha por linha.

---

## 3. Sinalização Inteligente em Tempo Real na Operação da Loja

Através do hook centralizador `useClientAbcMap`, a classificação ABC é consumida dinamicamente nas telas operacionais:

### 🔔 1. No Dashboard de Novos Agendamentos
* **Priorização da Fila**: Agendamentos pendentes de clientes Classe A e B são automaticamente ordenados no topo da lista para atenção prioritária da equipe.
* **Destaque Visual**:
  - Classe A: Borda esmeralda reforçada, brilho sutil e selo `💎 Tutor VIP · Classe A`.
  - Classe B: Borda azul e selo `📈 Tutor Regular · Classe B`.
* **Caixa de Ação Comercial Sugerida**:
  - **Classe A**: Sugestão de **10% de desconto de fidelidade** ou mimo/hidratação especial de cortesia, com botão direto para confirmar no WhatsApp já com o texto personalizado pronto.
  - **Classe B**: Sugestão de **combo promocional com 5% de desconto** em serviço adicional (ex: hidratação ou tosa higiênica) ou pacote mensal.
  - **Classe C**: Sugestão de boas-vindas e carimbo no cartão fidelidade.

### 📅 2. Na Aba "Agendamentos" (Agenda Geral)
* Cada card de agendamento exibe o selo da classe do tutor, seu gasto total acumulado e uma linha guia com a oportunidade comercial recomendada.

### 📦 3. Na Aba "Pedidos" (Loja Virtual)
* Ao receber um pedido da loja virtual, a equipe de separação visualiza se o comprador é um tutor VIP:
  - Sugestão automática para incluir amostra de petisco e bilhete de agradecimento na sacola para clientes Classe A.
  - Sugestão de cupom para 1º banho para clientes regulares de produtos.

---

## 4. Gráficos Executivos nos Relatórios de Curva ABC

Para garantir análise rápida e padronizada pela diretoria, todos os relatórios da Curva ABC contam com gráficos executivos no topo:
1. **Gráfico de Barras Horizontais**: Ranking com classes A, B e C, barras dimensionadas proporcionalmente e faturamento total destacado.
2. **Gráfico de Pizza / Donut (SVG)**: Visualização clara da proporção de receita gerada por categoria ou classe, com legenda de percentuais e valor total consolidado no centro.
3. **Normalização de Categorias**: Tratamento automático de nomes (maiúsculas/minúsculas e singular/plural) para unificar registros e evitar duplicidades (ex: "Banho (1 atendimento)" e "Banho (3 atendimentos)").

---

## 5. Relatório Financeiro Geral (`ReportPreview.tsx`)

O relatório financeiro analítico da loja foi modernizado para oferecer melhor clareza gerencial:
1. **Gráfico de Barras Horizontais**: Substitui as antigas barras verticais, apresentando o faturamento realizado de cada categoria (Serviços prestados, Vendas de produtos e Taxas de transporte) com barra de progresso horizontal e indicação de valores em aberto.
2. **Resumo Acumulado com Gráfico de Pizza**: Exibe a fatia proporcional de cada categoria na receita bruta da loja em gráfico de pizza (donut SVG) de alta nitidez.
3. **Destaque da Campanha Niver no Rodapé**: Exibição da quantidade e percentual de atendimentos beneficiados pela campanha de aniversário no rodapé do cartão do gráfico.

---

## 6. Gestão de Porte e Peso dos Pets no Painel do Administrador

Permite controle detalhado do tamanho e peso dos pets atendidos:
1. **Cadastro em "Novo Cliente"**: Seleção do porte do pet entre **Pequeno**, **Médio** e **Grande**, e entrada opcional do peso estimado em kg com validação numérica decimal.
2. **Diretório "Clientes"**: Exibição visual do porte e peso em tags destacadas em cada pet do tutor.
3. **Edição Completa**: Botão de edição inline (lápis) permite atualizar nome, raça, porte e peso do pet instantaneamente no banco de dados (`public.pets`).
4. **Impacto Operacional**: Vinculação automática com a triagem de veículos de transporte leva-e-traz (motos vs carros) e histórico de peso no prontuário veterinário.

---

## 7. Estrutura de Arquivos e Componentes

| Arquivo | Descrição |
| :--- | :--- |
| `src/lib/curvaAbc.ts` | Tipagens (`ClientAbcItem`, `ClientAbcSummary`), algoritmo de distribuição acumulada e exportação Excel `exportClientAbcXLSX`. |
| `src/components/CurvaAbcVisualCharts.tsx` | Componentes visuais executivos: `AbcHorizontalBarChart` e `AbcDonutChart`. |
| `src/components/CurvaAbcServicos.tsx` | Relatório ABC de serviços com gráficos e tabela analítica. |
| `src/components/CurvaAbcProdutos.tsx` | Relatório ABC de produtos com gráficos e tabela analítica. |
| `src/components/CurvaAbcClientes.tsx` | Relatório ABC de clientes com 4 dashboards e radar de retenção. |
| `src/components/ReportPreview.tsx` | Pré-visualização do relatório financeiro com barras horizontais e pizza no resumo acumulado. |
| `src/hooks/useClientAbcMap.ts` | Hook de sinalização de clientes em tempo real por ID e telefone. |
| `src/routes/_authenticated/admin.tsx` | Gestão de clientes (porte/peso), relatórios financeiros e sinalizações operacionais. |

---

## 8. Garantia de Qualidade e Deploy

* **Tipagem Estrita**: 100% aprovado no `npx tsc --noEmit`.
* **Testes Automatizados**: Suíte de testes automatizados com cobertura completa de navegação, relatórios e permissões.
* **Deploy Automático**: Sincronização direta com a branch `main` conectada à Vercel (`https://big-dog-pet-mu.vercel.app`).

