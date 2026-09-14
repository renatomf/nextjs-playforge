<div align="center">

# Sandbox

**Descreva um jogo. Veja ele ser construído. Jogue na hora.**

Construtor agêntico de jogos 3D: um agente de IA planeja a cena, escreve o código em Three.js
dentro de um sandbox isolado na nuvem e entrega um jogo jogável ao lado do chat.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square)](https://nextjs.org)
[![AI SDK](https://img.shields.io/badge/AI_SDK-v7-111111?style=flat-square)](https://ai-sdk.dev)
[![Trigger.dev](https://img.shields.io/badge/Trigger.dev-v4_chat.agent-2563EB?style=flat-square)](https://trigger.dev)
[![Daytona](https://img.shields.io/badge/Daytona-Sandboxes-0A0A0A?style=flat-square)](https://daytona.io)
[![Three.js](https://img.shields.io/badge/Three.js-r186-049EF4?style=flat-square)](https://threejs.org)
[![Neon](https://img.shields.io/badge/Neon-Postgres-00E5A0?style=flat-square)](https://neon.com)
[![Clerk](https://img.shields.io/badge/Clerk-Auth_%2B_Billing-6C47FF?style=flat-square)](https://clerk.com)
[![Sentry](https://img.shields.io/badge/Sentry-Observabilidade-362D59?style=flat-square)](https://sentry.io)

<br/>

![Sandbox: o agente fazendo perguntas de múltipla escolha no chat, com o preview do jogo ao lado](docs/screenshot.png)

</div>

Aqui, fazer um jogo é conversar. Você descreve o que quer — um racer, um shooter, um puzzle, um
mundo inteiro — e um agente assume: faz as perguntas que a descrição deixou em aberto, escreve os
arquivos do jogo num computador isolado na nuvem e, a cada resposta, o preview ao lado recarrega com
a versão nova. Pediu uma mudança? É só mandar outra mensagem no mesmo chat.

Cada organização tem os próprios jogos, os próprios créditos e um plano de assinatura. Cada passo do
modelo é cobrado ao centavo — na verdade, ao bilionésimo de dólar.

**Atalhos** · [O que faz](#-o-que-faz) · [Stack](#️-stack-completa) · [Modelos](#-os-modelos) ·
[Como funciona](#️-como-funciona) · [Arquitetura](#️-arquitetura) · [Estrutura](#-estrutura-do-projeto) ·
[**Como rodar**](#-como-rodar-localmente) · [Chaves de API](#-onde-pegar-cada-chave) ·
[Deploy](#-deploy) · [Decisões de engenharia](#-decisões-de-engenharia)

---

## ✨ O que faz

| | |
| --- | --- |
| **Jogo a partir de texto** | Um prompt vira um jogo 3D jogável. O agente escreve HTML, CSS e JavaScript sobre uma engine própria montada em cima do Three.js. |
| **Um computador por jogo** | Cada jogo ganha o próprio sandbox no Daytona: sistema de arquivos, processo e porta próprios. O código gerado nunca roda no servidor do app. |
| **Perguntas antes de construir** | Com a ferramenta `ask_player`, o agente pergunta — em múltipla escolha — o que a descrição deixou em aberto: loop, objetivo, controles, mundo, visual, sensação, som e desafio. |
| **Agente durável** | O chat roda como `chat.agent` do Trigger.dev, solto do request HTTP. Fechar a aba não derruba a resposta; recarregar a página retoma o stream de onde parou. |
| **Cinco modelos à escolha** | Opus 5, Gemini 3.8 Flash, GPT-OSS 120B (Groq), Qwen 3.8 Max e Qwen3 8B rodando localmente no Ollama. O modelo é escolhido por mensagem. |
| **Preview ao vivo** | O jogo roda num `iframe` servido pelo próprio sandbox. Ele recarrega a cada turno concluído, e o primeiro erro do jogo vai direto para o Sentry. |
| **Créditos medidos por passo** | Um ledger append-only cobra cada passo do modelo pelo preço de tabela do provedor, separando tokens novos, lidos do cache e gravados no cache. |
| **Base de SaaS pronta** | Organizations e Billing do Clerk: US$ 1 de crédito grátis por organização e US$ 10 por mês pago, com os créditos acumulando de um mês para o outro. |
| **Multi-tenant de verdade** | Toda query é filtrada pela organização ativa. O worker, que roda sem sessão, só age sobre jogos cujo acesso já foi conferido no servidor. |
| **Observabilidade ponta a ponta** | Sentry no navegador, no servidor, na edge e dentro do worker de tasks, com logs estruturados por turno, por ferramenta e por sandbox. |

---

## 🛠️ Stack completa

| Camada | Tecnologia |
| --- | --- |
| **Framework** | Next.js `16.2.6` (App Router, Turbopack), React `19.2.4`, TypeScript `^5` |
| **Agente de IA** | AI SDK `ai` `^7.0.97` — `streamText`, tools tipadas com Zod, `useChat` |
| **Agente durável** | Trigger.dev `4.5.16` — `chat.agent`, sessões e realtime · runtime `node-24` |
| **Provedores de modelo** | `@ai-sdk/anthropic` · `@ai-sdk/google` · `@ai-sdk/groq` · `@ai-sdk/alibaba` · `ollama-ai-provider-v2` |
| **Sandboxes** | Daytona `@daytona/sdk` `^0.211.2` — um sandbox por jogo, preview por URL assinada |
| **Runtime do jogo** | Three.js `0.186.0` via import map (jsDelivr) + engine própria em `lib/games/runtime/engine` |
| **Banco de dados** | Neon Postgres (driver HTTP `@neondatabase/serverless` `^1.1.0`) + Drizzle ORM `^0.45.2` |
| **Auth** | Clerk `^7.9.1` — Organizations, `OrganizationSwitcher`, `auth.protect()` |
| **Billing** | Clerk Billing — `PricingTable` por organização, reconciliado com o ledger |
| **Error tracking** | Sentry `^10.74.0` — `@sentry/nextjs` no app, `@sentry/node` no worker, source maps dos dois lados |
| **Estilo / UI** | Tailwind CSS `^4`, shadcn/ui `^4.21.0` (estilo `base-nova` sobre Base UI `^1.8.0`), `lucide-react` |
| **Validação** | Zod `^4.6.2` — entrada das tools, `clientData` do chat, schemas de saída |

> No Next.js 16 o *Middleware* virou **Proxy** — daí o `proxy.ts` na raiz no lugar do
> `middleware.ts`. Ele roda `clerkMiddleware()` e mais nada.

> O Neon entra com duas connection strings: a `DATABASE_URL` (com pool, via PgBouncer) para a
> aplicação e a `DATABASE_URL_UNPOOLED` (direta) para o `drizzle-kit`. O PgBouncer trabalha em modo
> transação e não aguenta as operações de sessão que o `drizzle-kit` usa.

> **O schema é sincronizado, não migrado.** O projeto está em desenvolvimento e não tem compromisso de
> compatibilidade, então mudanças no `lib/db/schema.ts` são aplicadas com `npm run db:push`. Não há
> pasta `drizzle/` nem `drizzle-kit migrate` — e não deve haver.

---

## 🤖 Os modelos

O catálogo mora em dois arquivos de propósito: `lib/ai/model-catalog.ts` (ids, nomes e taglines,
**seguro para o cliente**, lido pelo seletor de modelo) e `lib/ai/models.ts` (a instância de cada
provedor, **só no servidor**). O `satisfies Record<GameModelId, …>` nos dois lados — e na tabela de
preços — transforma um modelo esquecido em erro de compilação.

| Modelo | id | Provedor | Chave | US$ / 1M tokens (entrada · saída) | Indicado para |
| --- | --- | --- | --- | --- | --- |
| **Opus 5** ⭐ | `claude-opus-5` | Anthropic | `ANTHROPIC_API_KEY` | 5 · 25 | Jogo do zero — o padrão |
| **Gemini 3.8 Flash** | `gemini-3.8-flash` | Google | `GOOGLE_GENERATIVE_AI_API_KEY` | 0,75 · 3,75 | Mudanças do dia a dia |
| **GPT-OSS 120B** | `openai/gpt-oss-120b` | Groq | `GROQ_API_KEY` | 0,15 · 0,60 | Ajustes pequenos, resposta mais rápida |
| **Qwen 3.8 Max** | `qwen3.8-max` | Alibaba Model Studio | `DASHSCOPE_API_KEY` | 2 · 6 | Construtor completo |
| **Qwen3 8B (local)** | `qwen3:8b` | Ollama | — | grátis | Ajustes pequenos, privado |
| *Claude Haiku 4.5* | `claude-haiku-4-5` | Anthropic | `ANTHROPIC_API_KEY` | — | Só gera o título do jogo |

> ⭐ **A `ANTHROPIC_API_KEY` é obrigatória** mesmo que você só use outros modelos: o título de todo
> jogo novo é gerado pelo Haiku, dentro do `createGame`.

Os preços ficam em `lib/credits/pricing.ts`, com o preço de leitura e de escrita no cache de cada
provedor, e foram conferidos em 2026-09-13. O Gemini está em preço promocional até 2026-12-31 e dobra
em 2027-01-01.

### As ferramentas do agente

| Ferramenta | O que faz | Detalhe |
| --- | --- | --- |
| `write_file` | Cria ou sobrescreve um arquivo | Sempre recebe o conteúdo **completo**; pastas são criadas conforme precisa |
| `replace_text` | Troca um trecho exato | O trecho precisa aparecer **uma vez só**, a menos que `replaceAll` seja `true` |
| `read_file` | Lê um arquivo inteiro | O agente é instruído a ler antes de editar |
| `list_files` | Lista a pasta do jogo | Recursivo, até 10 níveis |
| `delete_file` | Apaga um arquivo ou uma pasta | Recursivo |
| `ask_player` | Pergunta de múltipla escolha | 2 a 4 opções, sobre uma de 8 dimensões do jogo. **Não tem `execute`**: quem responde é a pessoa |

Todo caminho é resolvido contra `/home/daytona/game` e recusado se sair de lá — `../.bashrc` e
`/etc/passwd` param no `resolveGamePath`.

---

## ⚙️ Como funciona

### O caminho de um jogo novo

```mermaid
%%{init: {'themeVariables': {'clusterBkg': 'rgba(127,127,127,0.14)', 'clusterBorder': 'rgba(127,127,127,0.50)', 'noteBkgColor': 'rgba(127,127,127,0.14)', 'noteBorderColor': 'rgba(127,127,127,0.50)', 'labelBoxBkgColor': 'rgba(127,127,127,0.14)', 'labelBoxBorderColor': 'rgba(127,127,127,0.50)'}}}%%
sequenceDiagram
    autonumber
    actor P as 👤 Pessoa
    participant UI as 🖥️ Navegador
    participant N as ▲ Next.js
    participant PG as 🐘 Neon
    participant T as 🔵 Worker game-chat
    participant M as 🤖 Modelo
    participant D as 📦 Daytona

    P->>UI: descreve o jogo e escolhe o modelo
    UI->>N: createGame com prompt e modelId
    N->>N: auth — exige userId e orgId
    N->>M: generateText com Haiku 4.5 — título
    N->>PG: INSERT games com o prompt como 1a mensagem
    N-->>UI: redirect para /games/id?model=...

    UI->>UI: a thread termina numa mensagem do usuário — regenerate
    UI->>N: startChatSession
    N->>PG: hasCredits da organização
    N->>T: cria a sessão e a primeira run — idempotente por chatId
    N-->>UI: token público preso à sessão, válido por 1h

    T->>D: onChatStart — daytona.create e seed do runtime
    T->>PG: UPDATE games SET sandbox_id
    T->>PG: hydrateMessages — carrega a thread salva

    loop até 30 passos
        T->>M: streamText com instruções e ferramentas
        M-->>T: texto e tool calls
        T->>D: read, write, replace, list, delete
        T->>PG: chargeStep — INSERT no ledger
        T-->>UI: stream — texto, ferramentas e data-balance
    end

    T->>PG: saveGameMessages com lastEventId
    T-->>UI: turn-completed
    UI->>N: GET /api/games/id/preview
    N->>D: startGameServer — acorda o sandbox e sobe o servidor na 8080
    N-->>UI: URL de preview assinada
    UI->>D: o iframe carrega o jogo
```

O navegador conversa com o Trigger.dev **direto**, pelo `useTriggerChatTransport`. O Next.js só faz
duas coisas no chat: abrir a sessão (`startChatSession`) e emitir tokens (`mintChatAccessToken`),
sempre depois de conferir que o jogo é da organização de quem pediu.

### Um jogo = um chat = um sandbox

O id do chat **é** o id do jogo. A coluna `games.messages` é a fonte da verdade da conversa: o
`hydrateMessages` carrega a thread do banco a cada turno, e o cliente manda só a mensagem nova — ou
nenhuma, quando quer uma resposta para a thread já salva, como no primeiro prompt.

| O quê | Onde mora | Quem escreve |
| --- | --- | --- |
| Conversa | `games.messages` (jsonb, formato `UIMessage` do AI SDK) | o worker, antes do modelo começar e ao fim de cada turno |
| Cursor do stream | `games.last_event_id` | o worker, no **mesmo UPDATE** da conversa |
| Arquivos do jogo | `/home/daytona/game` no sandbox | as ferramentas do agente |
| Sandbox | `games.sandbox_id` + label `gameId` no Daytona | o `onChatStart` |
| Créditos | `credit_ledger` | cobranças por passo e concessões mensais |

### A pergunta ao jogador (human-in-the-loop)

```mermaid
%%{init: {'themeVariables': {'clusterBkg': 'rgba(127,127,127,0.14)', 'clusterBorder': 'rgba(127,127,127,0.50)', 'noteBkgColor': 'rgba(127,127,127,0.14)', 'noteBorderColor': 'rgba(127,127,127,0.50)', 'labelBoxBkgColor': 'rgba(127,127,127,0.14)', 'labelBoxBorderColor': 'rgba(127,127,127,0.50)'}}}%%
stateDiagram-v2
    [*] --> Respondendo: turno começa
    Respondendo --> Aguardando: modelo chama ask_player
    Aguardando --> Respondida: pessoa escolhe uma opção
    Respondida --> Respondendo: sendAutomaticallyWhen abre o turno seguinte
    Respondendo --> Concluido: modelo termina sem pergunta
    Concluido --> [*]

    note right of Aguardando
        O turno termina com a chamada pendente.
        O composer fica travado até a resposta,
        porque uma mensagem nova deixaria a
        pergunta sem resposta.
    end note
```

Como o `ask_player` não tem `execute`, chamar a ferramenta **encerra o turno** com a chamada em
`input-available`. A resposta volta como uma cópia enxuta da mensagem do assistente, e o
`applyAnswers` a encaixa na resposta salva **pelo `toolCallId`** — a cópia nem sempre mantém o id da
mensagem original. A resposta é salva antes de o modelo voltar a falar, então um reload no meio do
caminho não faz a pergunta de novo.

### Recarregar no meio da resposta

O `lastEventId` salvo com a conversa vira `initialSession` na página do jogo, e o `useChat` sobe com
`resume: true`. Dois `TransformStream` mantêm o stream coerente:

- **`fromTurnStart`** descarta o que um turno novo repete do turno anterior. Depois de um *stop*, o
  transport retoma do último chunk lido e reenvia o resto daquele turno: deltas de partes que esse
  stream nunca abriu, que o `useChat` recusaria (`Received tool-input-delta for missing tool call`).
  Partes `data-*` e erros passam sempre.
- **`withSavedReply`** recoloca as partes salvas na frente das retomadas quando a resposta em curso
  continua a última salva. Sem isso, a pergunta respondida pisca e some.

### O preview

```mermaid
%%{init: {'themeVariables': {'clusterBkg': 'rgba(127,127,127,0.14)', 'clusterBorder': 'rgba(127,127,127,0.50)', 'noteBkgColor': 'rgba(127,127,127,0.14)', 'noteBorderColor': 'rgba(127,127,127,0.50)', 'labelBoxBkgColor': 'rgba(127,127,127,0.14)', 'labelBoxBorderColor': 'rgba(127,127,127,0.50)'}}}%%
flowchart LR
    T["Turno concluído<br/>revision + 1"] --> R["GET /api/games/id/preview"]
    R --> G{"getGame<br/>é da org de quem pede?"}
    G -->|"não"| NF["404"]
    G -->|"sim"| W["getStartedSandbox<br/>acorda se estiver parado"]
    W --> U{"curl localhost:8080<br/>servidor de pé?"}
    U -->|"não"| S["nohup python3 -m http.server 8080"]
    U -->|"sim"| L
    S --> L["getSignedPreviewUrl<br/>token no host, 1h"]
    L --> I["iframe remontado<br/>key = revision"]
    I --> C{"report.js respondeu<br/>game-status?"}
    C -->|"sim"| Show["Mostra o jogo"]
    C -->|"não, em 1,5s"| Warn["Mostra a página mesmo assim<br/>ex.: aviso do Daytona"]
    Show --> Ping["Ping a cada 2s<br/>1o erro vai para o Sentry"]
```

- **A URL é assinada** porque o token precisa estar na própria URL: um `iframe` não manda header. O
  token vai no host, então a origem é removida do stack antes de o erro ser logado.
- **O `iframe` é remontado a cada turno** (`key={revision}`). O Daytona pode devolver a mesma URL
  depois de uma atualização, e um `src` igual não recarrega nada.
- **A página só aparece quando o jogo responde.** O `report.js` (primeiro script do `<head>` de todo
  jogo) responde a cada `game-ping` com um `game-status`. Até isso acontecer, o `iframe` fica coberto
  por um fundo `#262624` — assim a página "Redirecting…" do Daytona, que não tem estilo, nunca pisca
  em branco.
- **O primeiro erro do jogo vai para o Sentry**, com o stack inteiro. O `report.js` pega erros de
  script e de carregamento (fase de captura), `unhandledrejection` e os erros que a própria engine
  captura via `window.recordGameError`.

### Créditos

```mermaid
%%{init: {'themeVariables': {'clusterBkg': 'rgba(127,127,127,0.14)', 'clusterBorder': 'rgba(127,127,127,0.50)', 'noteBkgColor': 'rgba(127,127,127,0.14)', 'noteBorderColor': 'rgba(127,127,127,0.50)', 'labelBoxBkgColor': 'rgba(127,127,127,0.14)', 'labelBoxBorderColor': 'rgba(127,127,127,0.50)'}}}%%
flowchart TB
    Start["Sessão nova ou turno novo"] --> Bal{"getBalance maior que 0?<br/>US$ 1 grátis + soma do ledger"}
    Bal -->|"sim"| Run["streamText roda"]
    Bal -->|"não"| Rec["reconcileCredits<br/>assinatura da org no Clerk Billing"]
    Rec --> Grant["INSERT month:AAAA-MM<br/>+ US$ 10 por mês pago<br/>ON CONFLICT DO NOTHING"]
    Grant --> Bal2{"saldo maior que 0 agora?"}
    Bal2 -->|"sim"| Run
    Bal2 -->|"não"| Block["data-out-of-credits<br/>transiente, nada é salvo"]
    Run --> Step["Cada passo do modelo"]
    Step --> Charge["INSERT step:responseId<br/>valor negativo<br/>ON CONFLICT DO NOTHING"]
    Charge --> Push["data-balance<br/>a sidebar atualiza ao vivo"]
```

- **O saldo é a soma do ledger** mais US$ 1 que não é uma linha — uma organização sem linha nenhuma lê
  exatamente US$ 1,00.
- **A unidade é o bilionésimo de dólar** (`DOLLAR = 1_000_000_000`). Um passo barato custa fração de
  centavo, e a soma precisa fechar exata. `bigint` em modo `number` é exato até 2^53, cerca de US$ 9
  milhões.
- **Toda escrita é idempotente.** A chave única `(org_id, entry_key)` garante que o mesmo passo
  (`step:<responseId>`) nunca seja cobrado duas vezes nem o mesmo mês (`month:2026-09`) concedido
  duas vezes.
- **A reconciliação é preguiçosa.** Ela só consulta o Clerk quando o saldo zera e quando alguém abre
  `/billing`. Um saldo zerado pode significar só que um mês pago renovou desde a última sincronização.
- **Uma resposta em curso pode terminar abaixo de zero.** O bloqueio vale para o turno seguinte, e uma
  cobrança que falha é reportada ao Sentry sem cortar a resposta.

---

## 🏗️ Arquitetura

### Visão geral

```mermaid
%%{init: {'themeVariables': {'clusterBkg': 'rgba(127,127,127,0.14)', 'clusterBorder': 'rgba(127,127,127,0.50)', 'noteBkgColor': 'rgba(127,127,127,0.14)', 'noteBorderColor': 'rgba(127,127,127,0.50)', 'labelBoxBkgColor': 'rgba(127,127,127,0.14)', 'labelBoxBorderColor': 'rgba(127,127,127,0.50)'}}}%%
flowchart TB
    Pessoa(["👤 Pessoa da organização"])

    subgraph Nav["🖥️ Navegador"]
        Chat["Chat<br/>useChat + useTriggerChatTransport"]
        Preview["Preview<br/>iframe + ping do report.js"]
        Side["Sidebar<br/>jogos, créditos, organização"]
    end

    subgraph Web["▲ Next.js 16 · App Router"]
        Proxy["proxy.ts<br/>clerkMiddleware — só dá contexto"]
        Paginas["Páginas e layouts<br/>auth.protect"]
        Actions["Server Functions<br/>createGame · startChatSession<br/>mintChatAccessToken · rename · delete"]
        Rota["Route handlers<br/>preview · monitoring"]
        Queries["lib/games/queries.ts<br/>toda query filtra por orgId"]
    end

    Clerk[("🔐 Clerk<br/>login, organizações e planos")]
    Banco[("🐘 Neon Postgres<br/>games · credit_ledger")]

    subgraph Worker["🔵 Trigger.dev · chat.agent game-chat"]
        Hyd["hydrateMessages<br/>thread do banco"]
        Run["run — streamText<br/>até 30 passos"]
        Tools["Ferramentas<br/>arquivos + ask_player"]
        Done["onTurnComplete<br/>salva thread e cursor"]
    end

    LLM[("🤖 Provedores<br/>Anthropic · Google · Groq<br/>Alibaba · Ollama")]

    subgraph Box["📦 Daytona · um sandbox por jogo"]
        Files["/home/daytona/game<br/>index.html · engine/ · report.js"]
        Srv["python3 http.server :8080"]
        PxD["Proxy de preview<br/>URL assinada"]
    end

    Sentry[("🟣 Sentry<br/>erros, logs, traces, replay")]

    Pessoa --> Chat
    Pessoa --> Preview
    Pessoa -->|"login e organização ativa"| Clerk
    Clerk -->|"sessão"| Proxy
    Proxy --> Paginas
    Proxy --> Actions
    Proxy --> Rota
    Paginas --> Queries
    Actions --> Queries
    Rota --> Queries
    Queries --> Banco

    Chat -->|"abre sessão e pega token"| Actions
    Actions -->|"sessão + primeira run"| Hyd
    Chat <-->|"stream realtime<br/>token preso à sessão"| Run
    Hyd --> Banco
    Hyd --> Run
    Run --> LLM
    Run --> Tools
    Tools -->|"SDK do Daytona"| Files
    Run -->|"cobra cada passo"| Banco
    Run --> Done
    Done --> Banco
    Run -->|"reconcilia créditos"| Clerk

    Preview -->|"pede a URL"| Rota
    Rota -->|"acorda e sobe o servidor"| Srv
    Srv --> Files
    Preview -->|"carrega o jogo"| PxD
    PxD --> Srv

    Web -.->|"erros e logs"| Sentry
    Worker -.->|"onFailure + logs por turno"| Sentry
    Nav -.->|"túnel /monitoring"| Sentry
```

### Organograma do sistema

Quem é responsável pelo quê, de cima para baixo:

```mermaid
%%{init: {'themeVariables': {'clusterBkg': 'rgba(127,127,127,0.14)', 'clusterBorder': 'rgba(127,127,127,0.50)', 'noteBkgColor': 'rgba(127,127,127,0.14)', 'noteBorderColor': 'rgba(127,127,127,0.50)', 'labelBoxBkgColor': 'rgba(127,127,127,0.14)', 'labelBoxBorderColor': 'rgba(127,127,127,0.50)'}}}%%
flowchart TD
    Root["🎮 Sandbox"]

    Root --> Web["▲ App Next.js<br/>app/ · components/"]
    Root --> Dom["🧠 Domínio compartilhado<br/>lib/"]
    Root --> Wk["🔵 Worker Trigger.dev<br/>trigger/"]
    Root --> Rt["🕹️ Runtime do jogo<br/>lib/games/runtime/"]
    Root --> Cfg["⚙️ Configuração<br/>raiz do repositório"]

    Web --> W1["Rotas protegidas<br/>app/(app): home, games/id, billing"]
    Web --> W2["Rotas públicas<br/>sign-in · sign-up"]
    Web --> W3["Route handlers<br/>api/games/id/preview · monitoring"]
    Web --> W4["Chat e preview<br/>chat-thread · chat-preview · game-chat"]
    Web --> W5["Design system<br/>components/ui — shadcn base-nova"]

    Dom --> D1["lib/ai<br/>catálogo, modelos, agente"]
    Dom --> D2["lib/games<br/>actions, queries, tools, instructions"]
    Dom --> D3["lib/credits<br/>ledger, pricing, reconcile"]
    Dom --> D4["lib/daytona<br/>ciclo de vida do sandbox"]
    Dom --> D5["lib/db<br/>schema e cliente Drizzle"]

    Wk --> K1["chat.ts<br/>o agente game-chat"]
    Wk --> K2["init.ts<br/>Sentry do worker"]
    Wk --> K3["example.ts · sentry-test.ts<br/>tasks de apoio"]

    Rt --> R1["index.html + style.css<br/>página de boas-vindas"]
    Rt --> R2["engine/<br/>core, input, hud, audio, physics,<br/>particles, camera, models, world, effects"]
    Rt --> R3["report.js<br/>ponte de erros com o app"]

    Cfg --> C1["trigger.config.ts · next.config.ts"]
    Cfg --> C2["drizzle.config.ts · neon.ts"]
    Cfg --> C3["proxy.ts · instrumentation*.ts · sentry.*.config.ts"]
```

### Onde cada código roda

Esse é o ponto que mais pega quem chega no projeto: **o mesmo `lib/` roda em dois processos
diferentes**, e só um deles é Next.js.

| Processo | O que roda ali | Consequência |
| --- | --- | --- |
| **Servidor Next.js** | páginas, Server Functions, route handlers, `lib/*` | tem `auth()` do Clerk; usa `@sentry/nextjs` |
| **Worker do Trigger.dev** | `trigger/chat.ts` e o `lib/*` que ele importa (tools, créditos, Daytona, banco) | **não tem request nem `auth()`**. Usa `@sentry/node` e `@clerk/backend`, e descobre a organização pela linha do jogo |
| **Navegador do app** | componentes `"use client"`, `useChat`, transport do Trigger.dev | só recebe tokens escopados e mensagens de erro genéricas |
| **Sandbox do Daytona** | os arquivos do jogo e um `http.server` | executa código gerado pelo modelo — isolado do app |
| **`iframe` do preview** | o jogo, em outra origem | conversa com o app só por `postMessage` com a origem conferida |

Por isso o `lib/` compartilhado importa `@sentry/node` (o SDK do Next.js é construído sobre ele e
divide o mesmo client) e por isso o `trigger.config.ts` usa a condição `react-server`: os módulos que
importam `server-only` resolvem para a versão vazia dentro do worker.

### Modelo de dados

```sql
games
  id              uuid          pk, default random
  org_id          text          not null      -- organização do Clerk (org_...)
  title           text          not null
  messages        jsonb         not null, default []  -- UIMessage[] do AI SDK
  last_event_id   text                        -- cursor do stream do Trigger.dev
  sandbox_id      text                        -- sandbox do Daytona
  created_at      timestamptz   not null
  updated_at      timestamptz   not null      -- $onUpdate
  index games_org_id_created_at_idx (org_id, created_at)

credit_ledger                                 -- append-only
  id              uuid          pk, default random
  org_id          text          not null      -- sem FK: organizações vivem no Clerk
  entry_key       text          not null      -- step:<responseId> | month:<AAAA-MM>
  amount          bigint        not null      -- bilionésimos de dólar, negativo = cobrança
  created_at      timestamptz   not null
  unique credit_ledger_org_id_entry_key_unique (org_id, entry_key)
```

### Multi-tenancy e autenticação

**A autenticação fica no recurso, não no proxy.** O `proxy.ts` roda `clerkMiddleware()` e mais nada.
Server Functions são chamadas por **id**, não por rota, então uma trava por caminho no middleware não
as protegeria.

| Superfície | Como se protege | Resposta a quem não pode |
| --- | --- | --- |
| Páginas | `auth.protect()` | redireciona para `/sign-in` |
| `createGame` · `renameGame` · `deleteGame` | exigem `userId` e `orgId`, e o `getGame` confere o dono | erro |
| `startChatSession` · `mintChatAccessToken` | `assertCanChat` — o chatId vem do navegador | erro, logado como `Chat access denied` |
| `GET /api/games/[id]/preview` | `getGame` com escopo da organização | `404` |
| Queries | `getGame` / `listGames` sempre filtram por `orgId` e validam o UUID antes de ir ao banco | `null` / `[]` |
| Worker | só age sobre um `chatId` cuja sessão foi aberta por uma Server Function que conferiu o acesso | — |

O token que o navegador recebe do Trigger.dev é **escopado à sessão daquele jogo** (`read` e `write`
em `sessions: chatId`) e expira em 1 hora; o transport pede outro sozinho.

### Observabilidade

| Onde | Como chega no Sentry |
| --- | --- |
| Navegador | `instrumentation-client.ts` — traces (100% em dev, 10% em produção), Session Replay (10%, 100% com erro), túnel em `/monitoring` |
| Servidor / Edge | `instrumentation.ts` + `onRequestError`, com `includeLocalVariables` |
| Worker | `trigger/init.ts` — `tasks.onFailure` global depois das retentativas e `onStartAttempt` marcando cada log com a task e a run |
| Turno do chat | `onTurnComplete` — um log por turno com modelo, tokens, ferramentas, erros de ferramenta e se ficou esperando o jogador |
| Jogo | o primeiro erro de cada revisão, com o stack do jogo sem o token da URL |
| Source maps | `withSentryConfig` no `next.config.ts` (app) e `sentryEsbuildPlugin` no `trigger.config.ts` (worker, só no deploy) |

O túnel `/monitoring` é uma **rota própria**, e não o `tunnelRoute` do SDK: o rewrite repassaria os
cookies do navegador — incluindo a sessão do Clerk — e a ingestão do Sentry recusa cabeçalhos
grandes. A rota só encaminha envelopes do DSN do próprio projeto, então não vira relay aberto.

---

## 📁 Estrutura do projeto

| Pasta | Responsabilidade |
| --- | --- |
| **`app/`** | Roteia e protege. Nenhuma regra de negócio mora aqui. |
| **`components/`** | A interface: chat, preview, sidebar e o design system em `ui/`. |
| **`lib/`** | O domínio, compartilhado entre o Next.js e o worker. |
| **`trigger/`** | As tasks do Trigger.dev — o agente e sua inicialização. |
| **raiz** | Configuração de build, runtime e observabilidade. |

### `app/` — rotas

```
app/
├── (app)/
│   ├── layout.tsx                     sidebar + saldo de créditos da organização
│   ├── page.tsx                       "What should we build today?" + composer
│   ├── games/[id]/page.tsx            chat + preview; entrega o cursor para retomar
│   └── billing/page.tsx               saldo, reconciliação e PricingTable
│
├── sign-in/[[...sign-in]]/            <SignIn /> do Clerk
├── sign-up/[[...sign-up]]/            <SignUp /> do Clerk
│
├── api/games/[id]/preview/route.ts    acorda o sandbox e devolve a URL assinada
├── monitoring/route.ts                túnel do Sentry (valida o DSN)
├── global-error.tsx
└── layout.tsx                         ClerkProvider + ThemeProvider + fontes
```

### `components/` — interface

```
components/
├── chat-thread.tsx                    useChat + transport, ask_player, retomada
├── chat-composer.tsx                  campo de mensagem + seletor de modelo
├── chat-preview.tsx                   iframe, cobertura e ping de erros
├── game-chat.tsx                      painéis redimensionáveis thread | preview
├── new-game-composer.tsx              prompt inicial e sugestões
├── model-picker.tsx                   lê o model-catalog (seguro para o cliente)
├── credit-balance.tsx                 contexto do saldo, atualizado pelo stream
├── app-sidebar.tsx                    jogos, créditos, OrganizationSwitcher
├── game-header.tsx · game-actions-menu.tsx
├── theme-provider.tsx                 next-themes + atalho "d"
└── ui/                                shadcn/ui (base-nova)
```

### `lib/` — domínio

```
lib/
├── ai/
│   ├── model-catalog.ts               ids e nomes — sem import de provedor
│   ├── models.ts                      id → instância do provedor (server-only)
│   └── agent.ts                       modelo + instruções + limite de 30 passos
│
├── games/
│   ├── actions.ts                     Server Functions: criar, sessão, token, renomear, apagar
│   ├── queries.ts                     leituras com escopo de organização
│   ├── messages.ts                    leituras e escritas do worker (sem auth)
│   ├── tools.ts                       ferramentas de arquivo, presas a um jogo
│   ├── ask-player.ts                  a pergunta ao jogador (sem execute)
│   ├── instructions/                  system prompt: workflow · runtime · engine · design
│   ├── runtime/                  ◄──  os arquivos que todo jogo novo recebe
│   ├── seed.ts                        copia o runtime/ para o sandbox
│   ├── suggestions.ts · title.ts
│
├── credits/
│   ├── ledger.ts                      saldo e cobrança por passo
│   ├── pricing.ts                     preço por modelo e custo de um passo
│   ├── reconcile.ts                   Clerk Billing → concessões mensais
│   └── format.ts                      DOLLAR e formatação
│
├── daytona/
│   ├── client.ts                      new Daytona() — lê DAYTONA_API_KEY
│   └── utils.ts                       criar, acordar, apagar, subir o servidor
│
└── db/
    ├── schema.ts                      games + credit_ledger
    └── index.ts                       Drizzle sobre o driver HTTP do Neon
```

### Raiz — configuração

```
proxy.ts                               clerkMiddleware() e mais nada
trigger.config.ts                      node-24, Daytona external, runtime/ copiado, source maps
next.config.ts                         withSentryConfig
drizzle.config.ts                      aponta para a DATABASE_URL_UNPOOLED
neon.ts                                política de branches (TTL de 7 dias)
instrumentation.ts                     Sentry no servidor e na edge
instrumentation-client.ts              Sentry no navegador
sentry.server.config.ts · sentry.edge.config.ts
AGENTS.md · CLAUDE.md                  regras para agentes de código neste repo
```

---

## 🚀 Como rodar localmente

### Resumo

```bash
git clone https://github.com/renatomf/nextjs-sandbox.git
cd nextjs-sandbox
npm install

# crie o .env.local (modelo logo abaixo) e troque o project do trigger.config.ts

npm run db:push        # cria as tabelas no Neon
npm run dev            # terminal 1 → http://localhost:3000
npm run trigger:dev    # terminal 2 → worker do agente
```

São **dois processos**. Sem o `trigger:dev` rodando, o app abre, o jogo é criado, mas o chat nunca
responde — quem responde é o worker.

### Pré-requisitos

| Item | Versão / observação |
| --- | --- |
| **Node.js** | 24 (o worker roda em `node-24`; testado com `v24.20.0`) |
| **npm** | 11 |
| **Contas** | Clerk, Neon, Trigger.dev, Daytona e Anthropic — obrigatórias |
| **Opcionais** | Google AI Studio, Groq, Alibaba Model Studio, Sentry, [Ollama](https://ollama.com) |

### 1. Variáveis de ambiente

Crie um `.env.local` na raiz. Ele é lido pelo Next.js, pelo `drizzle-kit` (via `@next/env`) e pelo
worker em dev.

```bash
# ─── Clerk ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# ─── Neon ──────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://USER:PASS@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://USER:PASS@ep-xxx.REGION.aws.neon.tech/neondb?sslmode=require
NEON_BRANCH=                     # escrita pelo CLI do Neon; opcional

# ─── Trigger.dev ───────────────────────────────────────────────────────
TRIGGER_SECRET_KEY=tr_dev_...

# ─── Daytona ───────────────────────────────────────────────────────────
DAYTONA_API_KEY=...

# ─── Modelos ───────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...     # obrigatória (Opus 5 + títulos)
GOOGLE_GENERATIVE_AI_API_KEY=    # Gemini 3.8 Flash
GROQ_API_KEY=                    # GPT-OSS 120B
DASHSCOPE_API_KEY=               # Qwen 3.8 Max

# ─── Sentry (opcional) ─────────────────────────────────────────────────
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=               # só para subir source maps no build/deploy
```

> O `.gitignore` ignora `.env*` inteiro. Se quiser versionar um `.env.example`, acrescente
> `!.env.example` ao `.gitignore`.

#### Quem lê cada variável

| Variável | Obrigatória | Next.js | Worker | `drizzle-kit` |
| --- | :-: | :-: | :-: | :-: |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | ✅ | | |
| `CLERK_SECRET_KEY` | ✅ | ✅ | ✅ reconcilia créditos | |
| `NEXT_PUBLIC_CLERK_*_URL` | ✅ | ✅ | | |
| `DATABASE_URL` | ✅ | ✅ | ✅ | |
| `DATABASE_URL_UNPOOLED` | ✅ | | | ✅ |
| `TRIGGER_SECRET_KEY` | ✅ | ✅ abre sessões, emite tokens, cancela runs | | |
| `DAYTONA_API_KEY` | ✅ | ✅ preview e exclusão | ✅ cria o sandbox e as ferramentas | |
| `ANTHROPIC_API_KEY` | ✅ | ✅ título | ✅ Opus 5 | |
| `GOOGLE_GENERATIVE_AI_API_KEY` · `GROQ_API_KEY` · `DASHSCOPE_API_KEY` | só para usar o modelo | | ✅ | |
| `SENTRY_DSN` · `NEXT_PUBLIC_SENTRY_DSN` | recomendada | ✅ | ✅ | |
| `SENTRY_ORG` · `SENTRY_PROJECT` · `SENTRY_AUTH_TOKEN` | só para source maps | build | deploy | |

> ⚠️ **Sem `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN`, os eventos vão para o projeto Sentry original**:
> `sentry.*.config.ts`, `instrumentation-client.ts`, `trigger/init.ts` e `app/monitoring/route.ts` têm
> um DSN de fallback fixo no código. Num fork, defina o seu ou troque o fallback.

### 2. Aponte o Trigger.dev para o seu projeto

O `trigger.config.ts` traz o id do projeto original:

```ts
project: "proj_idhywzazknmimwoeeklp",
```

Troque pelo *Project ref* do seu projeto (dashboard do Trigger.dev → **Project settings**). Sem isso,
o `trigger:dev` tenta registrar o worker num projeto que não é seu.

### 3. Banco

```bash
npm run db:push
```

Cria `games` e `credit_ledger` a partir do `lib/db/schema.ts`. Rode de novo sempre que o schema
mudar. **Nunca** `drizzle-kit generate` ou `drizzle-kit migrate` — veja o `AGENTS.md`.

`npm run db:studio` abre o Drizzle Studio para inspecionar os dados.

### 4. Subir os dois processos

```bash
# terminal 1
npm run dev

# terminal 2
npm run trigger:dev
```

Na primeira vez, o `trigger:dev` pede login no navegador. Ele roda o worker **na sua máquina** e
registra as tasks `game-chat`, `hello-world` e `sentry-error-test` no ambiente **Dev** do projeto. Em
dev, o CLI carrega os arquivos `.env*` da raiz, então o mesmo `.env.local` serve para os dois
processos. Se alguma variável faltar dentro do worker, cadastre em **Environment Variables → Dev** no
dashboard do Trigger.dev.

### 5. Primeiro uso

1. Abra `http://localhost:3000` e crie uma conta.
2. Crie (ou escolha) uma **organização** — jogos, créditos e plano pertencem a ela.
3. Descreva um jogo, escolha o modelo e envie. A organização começa com **US$ 1** de crédito.
4. Responda às perguntas do agente. O preview aparece ao lado quando o primeiro turno termina.

### Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `Unauthorized: no active organization` ao criar um jogo | nenhuma organização ativa na sessão | crie uma no `OrganizationSwitcher` ou ative *Membership required* no Clerk |
| O chat fica carregando e nunca responde | o `trigger:dev` não está rodando, ou está em outro projeto | suba o worker; confira o `project` do `trigger.config.ts` |
| `DATABASE_URL_UNPOOLED is not set` | falta a URL direta no `.env.local` | copie do Neon (ou `neon env pull`) |
| Falha ao criar qualquer jogo, com qualquer modelo | falta a `ANTHROPIC_API_KEY` | o título sempre usa o Haiku |
| "Out of credits" | saldo da organização zerado | assine o plano em `/billing` |
| O preview mostra o aviso *Preview URL Warning* | tela do proxy do Daytona em organizações Tier 1 e 2 | clique em *Continue*; veja as [limitações](#️-limitações-conhecidas) |
| O modelo Qwen3 8B (local) falha | o Ollama não está rodando, ou o worker não está na sua máquina | `ollama pull qwen3:8b` e `ollama serve`; só funciona com `trigger:dev` |
| O worker não acha `form-data` ou `busboy` depois do deploy | o SDK do Daytona foi empacotado | mantenha o `external: ["@daytona/sdk"]` no `trigger.config.ts` |

---

## 🔑 Onde pegar cada chave

### Clerk — login, organizações e billing

1. Crie uma aplicação em [dashboard.clerk.com](https://dashboard.clerk.com).
2. **API keys** → copie a *Publishable key* (`pk_test_…`) e a *Secret key* (`sk_test_…`).
3. **Organizations** → ative. Recomendado: **Membership required**, para que toda sessão tenha uma
   organização ativa. O app exige `orgId` para criar jogos.
4. **Billing** → ative para **organizações** e crie um plano com mensalidade (a página de billing o
   apresenta como *Builder*). Qualquer plano com taxa-base conta como pago: cada mês pago concede
   US$ 10, e períodos de teste grátis não contam. Em desenvolvimento, o Clerk usa um gateway de
   pagamento de teste.
5. As URLs de login (`/sign-in`, `/sign-up`) já existem no app; basta preencher as variáveis
   `NEXT_PUBLIC_CLERK_*_URL`.

### Neon — Postgres

1. Crie um projeto em [console.neon.tech](https://console.neon.tech).
2. **Connection details** → copie a string **pooled** (host com `-pooler`) para `DATABASE_URL` e a
   **direta** para `DATABASE_URL_UNPOOLED`.
3. Alternativa: com o CLI do Neon, `neon env pull` escreve as duas no `.env.local`, e
   `neon checkout <nome>` cria um branch com TTL de 7 dias (política em `neon.ts`).

### Trigger.dev — o worker do agente

1. Crie um projeto em [cloud.trigger.dev](https://cloud.trigger.dev).
2. Copie o *Project ref* (`proj_…`) para o `trigger.config.ts`.
3. **API keys** → ambiente **Dev** → copie a *Secret key* (`tr_dev_…`) para `TRIGGER_SECRET_KEY`.
   Em produção, a chave é a do ambiente **Prod** (`tr_prod_…`).

### Daytona — os sandboxes

1. Crie uma conta em [app.daytona.io](https://app.daytona.io).
2. **Dashboard → API Keys** → crie uma chave com permissão para criar, listar e apagar sandboxes.
3. Cole em `DAYTONA_API_KEY`. O SDK lê a variável sozinho (`new Daytona()`).

O limite de recursos e o aviso do preview dependem do *tier* da organização no Daytona (veja
**Limits** no dashboard). Cada jogo usa um sandbox com a configuração padrão, e sandboxes ociosos
param sozinhos.

### Provedores de modelo

| Provedor | Onde | Variável |
| --- | --- | --- |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) → API Keys | `ANTHROPIC_API_KEY` |
| Google | [aistudio.google.com](https://aistudio.google.com) → Get API key | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Groq | [console.groq.com](https://console.groq.com) → API Keys | `GROQ_API_KEY` |
| Alibaba Model Studio | console do Model Studio (DashScope, região internacional) → API Key | `DASHSCOPE_API_KEY` |
| Ollama | local, sem chave: `ollama pull qwen3:8b` | — |

O provedor da Alibaba leria `ALIBABA_API_KEY` por padrão. O `lib/ai/models.ts` o cria com
`DASHSCOPE_API_KEY` de propósito.

### Sentry — opcional, mas recomendado

1. Crie um projeto **Next.js** em [sentry.io](https://sentry.io).
2. Copie o DSN para `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN`.
3. Para source maps: `SENTRY_ORG`, `SENTRY_PROJECT` e um *Auth token* com escopo de releases em
   `SENTRY_AUTH_TOKEN`. Sem o token, o build segue — só não sobe os mapas.
4. Para testar o worker: rode a task `sentry-error-test` na página **Test** do dashboard do
   Trigger.dev. Ela falha de propósito.

---

## 📦 Deploy

O app e o worker são publicados **separadamente**.

| Parte | Como | Variáveis |
| --- | --- | --- |
| **App Next.js** | qualquer host Node.js (`npm run build` + `npm run start`) | todas as da coluna Next.js, com `NEXT_PUBLIC_SENTRY_ENVIRONMENT=production` |
| **Worker** | `npm run trigger:deploy` | cadastradas no ambiente **Prod** do dashboard do Trigger.dev: `DATABASE_URL`, `CLERK_SECRET_KEY`, `DAYTONA_API_KEY`, chaves dos modelos, `SENTRY_DSN` |
| **Banco** | `npm run db:push` contra o branch de produção | `DATABASE_URL_UNPOOLED` do branch |
| **Clerk** | instância de **produção** com domínio próprio | chaves `pk_live_…` / `sk_live_…` |

No deploy do worker, `SENTRY_AUTH_TOKEN` precisa estar no ambiente **local** de quem roda o comando:
o plugin de source maps roda no build, na sua máquina.

### Scripts

| Script | O que faz |
| --- | --- |
| `dev` · `build` · `start` | O ciclo do Next.js |
| `lint` · `typecheck` · `format` | ESLint · `tsc --noEmit` · Prettier (com plugin do Tailwind) |
| `db:push` · `db:studio` | Drizzle Kit — sincroniza o schema · abre o Studio |
| `trigger:dev` · `trigger:deploy` | Worker local · publica o worker |

---

## 🧠 Decisões de engenharia

**O worker compartilha o `lib/` com o Next.js.** Ferramentas, créditos e acesso ao Daytona são
escritos uma vez só. O preço: o `lib/` não pode depender de nada que só exista no Next — por isso o
`@sentry/node` em vez do `@sentry/nextjs`, o `@clerk/backend` em vez do `auth()` e a condição
`react-server` no build do worker.

**O SDK do Daytona fica fora do bundle.** Ele carrega `form-data` (upload) e `busboy` (download) por
um alias de `require` próprio, que o esbuild não enxerga. Empacotado, ele não acha as duas
dependências depois do deploy. Como `external`, é instalado com elas.

**O runtime do jogo é copiado para o build, não importado.** Os arquivos de `lib/games/runtime` são
lidos com `fs` na hora de criar o sandbox; nada os importa, então o bundle os deixaria de fora. O
`additionalFiles` os copia, e `legacyDevProcessCwdBehaviour: false` faz o `process.cwd()` apontar
para o mesmo lugar em dev e em produção.

**O banco é a fonte da verdade da conversa, não o cliente.** O cliente manda só a mensagem nova; o
worker carrega a thread inteira a cada turno. Uma aba velha não consegue sobrescrever a conversa
com uma versão desatualizada.

**A conversa e o cursor são gravados no mesmo UPDATE.** Um reload nunca vê a thread nova com o
cursor do turno anterior — o que faria o stream repetir um turno já salvo.

**O cursor é salvo mesmo num turno que falhou.** Assim um reload retoma depois dele, em vez de
repetir o erro.

**Respostas vazias somem da thread.** Um turno que falha antes de o modelo escrever qualquer coisa
(provedor sobrecarregado, por exemplo) ainda gera uma mensagem de assistente sem conteúdo. O
`withoutEmptyReplies` a remove, e a thread continua terminando na pergunta sem resposta.

**O erro real vai para o Sentry, e o navegador recebe `An error occurred.`** Mensagens de provedor
podem carregar chave, URL interna ou stack trace.

**A escolha de modelo viaja na URL e é conferida em todo ponto.** O `?model=` do redirect passa pelo
`isGameModelId`, e o `clientData` de cada mensagem passa por um `z.enum(GAME_MODEL_IDS)`. Nada que
venha do navegador escolhe um modelo fora do catálogo.

**Um erro de ferramenta volta para o modelo, não para o Sentry como erro.** O modelo quase sempre
contorna sozinho: relê o arquivo, amplia o trecho, corrige o caminho. A falha vira um `warn` com a
ferramenta, o caminho e a mensagem, suficiente para explicar um turno que deu errado.

**O `replace_text` usa `split`/`join`, não `String.replace`.** O `replace` interpretaria `$&` e `$1`
dentro do código novo como padrões de substituição — e código JavaScript cheio de template strings
tem `$` de sobra.

**O `ask_player` fica fora do `tools.ts`.** As ferramentas de arquivo são `server-only`; a pergunta
precisa ter os tipos compartilhados com a UI (`InferUITool<typeof askPlayer>`).

**Apagar um jogo começa pela linha do banco.** Depois vêm: fechar a sessão (nenhuma mensagem nova
abre outra run), cancelar a run atual (que continuaria construindo — e cobrando — um jogo que não
existe mais) e apagar os sandboxes pelo label `gameId`. Na ordem contrária, um turno em andamento
poderia criar um sandbox novo para o jogo. E se um sandbox for criado depois que a linha sumiu, o
próprio `createGameSandbox` o apaga: nenhum sandbox sobrevive ao seu jogo.

**Os sandboxes são acordados sob demanda.** Ociosos, eles param sozinhos. A rota de preview e a
primeira ferramenta de cada turno os acordam, e o servidor do jogo é reiniciado se o sandbox tiver
reiniciado. Se o sandbox tiver sido apagado, um novo é criado a partir do runtime — e os arquivos
antigos se perdem, o que fica registrado no Sentry.

**Toda escrita no ledger é idempotente.** A chave `(org_id, entry_key)` torna seguro repetir uma
cobrança (retentativa do Trigger.dev) e reconciliar quantas vezes for preciso.

**A conta dos meses é feita em UTC.** O `addMonths` do `date-fns` usa o fuso do servidor e empurra
limites de mês para o dia anterior a oeste de UTC. O `reconcile.ts` tem a própria aritmética,
incluindo o caso do dia 31 em meses mais curtos.

**O Three.js está fixado em dois lugares que andam juntos:** o import map do
`lib/games/runtime/index.html` e a constante `THREE_VERSION` das instruções do agente. A engine e o
prompt foram escritos para a r186.

**O system prompt é dividido por assunto.** São quatro mensagens de sistema — workflow, runtime,
engine e design —, cada uma num arquivo, na ordem em que o agente precisa delas.

### O que deliberadamente não está aqui

- **Sem migrations.** O schema é sincronizado com `db:push` enquanto o projeto não tem
  compromisso de compatibilidade.
- **Sem API própria para o chat.** O navegador fala com o realtime do Trigger.dev com um token
  escopado. O Next.js só abre sessões e emite tokens — não passa stream nenhum.
- **Sem gerenciador de estado global.** A thread é do `useChat`, o saldo mora num contexto pequeno
  alimentado pelo próprio stream, e o resto vem do servidor.
- **Sem arquivos do jogo no banco.** O sandbox é a fonte da verdade dos arquivos; o banco guarda só
  a conversa e o id do sandbox.

---

## ⚠️ Limitações conhecidas

- **O aviso de preview do Daytona.** Em organizações Tier 1 e 2, o proxy do Daytona mostra uma tela
  de aviso na primeira visita a cada URL de preview. O app a exibe para você clicar e esconde a
  página "Redirecting…" que vem depois. O aviso some ao subir para o Tier 3 ou com um proxy de
  preview próprio que mande o header `X-Daytona-Skip-Preview-Warning: true`.
- **Apagar o sandbox apaga o jogo.** Os arquivos só existem no sandbox; não há volume nem cópia no
  banco. Um sandbox perdido volta como a página de boas-vindas.
- **O Qwen3 8B só funciona em dev.** O provedor do Ollama aponta para `localhost`, que só é a sua
  máquina quando o worker roda com `trigger:dev`.
- **Preços fixos no código.** A tabela de `pricing.ts` é o preço de lista conferido em 2026-09-13 e
  precisa de atualização manual — o Gemini, por exemplo, dobra de preço em 2027-01-01.
- **Configuração presa ao projeto original.** O `project` do `trigger.config.ts`, os fallbacks de DSN
  do Sentry e os defaults `ammodev`/`sandbox` de organização e projeto do Sentry apontam para o
  ambiente do autor.
- **Sem testes automatizados.** A verificação hoje é `typecheck`, `lint` e o Sentry.
- **O Clerk está com chaves de desenvolvimento**, limitadas a ~100 usuários e usando os apps OAuth de
  demonstração do próprio Clerk. Produção exige instância de produção e domínio próprio.
- **`AI_PROVIDER`** pode aparecer em `.env.local` antigos, mas nenhum código a lê — o modelo é
  escolhido por mensagem.
