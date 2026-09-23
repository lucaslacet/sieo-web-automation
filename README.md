# Automação Web para Diário de Classe - SIEO

Projeto independente de automação web criado para reduzir etapas repetitivas no preenchimento do Diário de Classe do SIEO.

A proposta surgiu a partir de um problema simples: uma atividade que parece pequena quando feita uma vez se torna cansativa quando precisa ser repetida em várias turmas, datas e registros.

> **Status:** em desenvolvimento e melhoria contínua.  
> **Tecnologias principais:** JavaScript, Tampermonkey, DOM, async/await e localStorage.

## O problema

O fluxo de registro envolve diversas ações repetitivas, como navegar entre datas, verificar aulas, selecionar horários, abrir o registro de habilidades, escolher um conteúdo, preencher campos de apoio e salvar.

O desafio técnico não se resume a automatizar cliques. Durante os testes, a interface apresentou comportamentos como:

- atualização visual da data antes da atualização real dos dados;
- conteúdo carregado de forma assíncrona;
- diferentes botões com o mesmo texto;
- campos que só aparecem após determinadas seleções;
- elementos reconstruídos pelo sistema depois de ações AJAX;
- necessidade de manter o andamento mesmo após atualizações da página.

## A solução

A automação foi estruturada para observar o estado da própria interface antes de continuar o fluxo.

Entre as funcionalidades trabalhadas estão:

- navegação automática por datas usando os controles reais da interface;
- verificação de dias com ou sem aula;
- identificação e seleção dos horários disponíveis;
- leitura dinâmica da tabela de habilidades;
- contagem automática dos conteúdos existentes;
- seleção sequencial dos itens em ordem crescente e decrescente;
- captura do texto da habilidade selecionada;
- preenchimento assistido de conteúdo, recurso e situação didática;
- persistência do andamento com `localStorage`;
- tratamento de erros sem interromper toda a execução.

## Exemplo da lógica de seleção dinâmica

A quantidade de conteúdos não é definida manualmente. O script analisa a tabela disponível e utiliza o total encontrado.

Exemplo com 5 itens:

```text
1 -> 2 -> 3 -> 4 -> 5 -> 4 -> 3 -> 2 -> 1 -> 2 ...
```

Se a lista tiver outra quantidade, a sequência é ajustada automaticamente.

## Decisões técnicas

Algumas decisões importantes tomadas durante o desenvolvimento:

### Esperar pelo estado real da interface

Em vez de depender apenas de tempos fixos, a automação verifica repetidamente se o elemento ou estado necessário realmente apareceu.

```javascript
async function aguardarCondicao(funcao, timeout = 10000, intervalo = 250) {
  const inicio = Date.now();

  while (Date.now() - inicio < timeout) {
    const resultado = funcao();
    if (resultado) return resultado;
    await new Promise(resolve => setTimeout(resolve, intervalo));
  }

  return null;
}
```

### Descobrir os itens dinamicamente

A automação não depende de uma disciplina específica nem de uma quantidade fixa de conteúdos. Ela percorre as linhas disponíveis no DOM e monta a lista em tempo de execução.

### Persistir o andamento

O `localStorage` mantém informações como data atual, posição da sequência e direção dos conteúdos, permitindo continuar o processo mesmo quando a interface é atualizada.

## Tecnologias e conceitos

- JavaScript
- Tampermonkey
- Manipulação de DOM
- Eventos `input` e `change`
- `async/await`
- Promises
- localStorage
- Tratamento de exceções
- Debugging
- Interfaces dinâmicas
- Automação de processos
- Lógica de controle de estado

## Próximas melhorias

- detectar automaticamente dias que já possuem registro;
- pular registros existentes sem duplicar informações;
- manter o mesmo conteúdo da sequência quando um dia já estiver preenchido;
- melhorar a validação após a gravação;
- reduzir dependência de seletores frágeis;
- ampliar logs e indicadores de execução.

## Demonstração

Há uma gravação de demonstração na pasta [`demo/`](demo/).

> Os materiais públicos do projeto devem permanecer anonimizados. Não devem ser publicados nomes de alunos, professores, escolas, credenciais, cookies, tokens ou qualquer informação privada do sistema.

## Uso responsável

Este é um projeto independente de estudo e automação. Não representa uma ferramenta oficial do SIEO ou da administração pública.

O uso de qualquer automação em sistemas de terceiros deve ocorrer somente com autorização adequada e respeitando regras internas, termos de uso, privacidade e proteção de dados.

## Objetivo profissional

Além de resolver uma tarefa prática, o projeto tem sido utilizado para aprofundar conhecimentos em desenvolvimento de sistemas, JavaScript, debugging, automação web e resolução de problemas em interfaces reais.
