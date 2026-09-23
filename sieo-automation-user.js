// ==UserScript==
// @name         Teste 1 - SIEO Automático
// @namespace    sieo-auto-diario
// @version      1.6
// @description  Automatiza datas, habilidades, conteúdo, recurso didático, situação didática e gravação no SIEO.
// @match        https://sieo.edu.olinda.pe.gov.br/diarioclasse/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'sieo_teste1_automatico_v16';

  const LIMITE_CONTEUDO = 1000;

  /*
    Estes textos não dependem da disciplina.
    São apenas os recursos/situações que serão alternados.
  */

  const RECURSOS = [
    'Livro didático',
    'Caderno',
    'DataShow',
    'Quadro',
    'Livro e caderno',
    'DataShow e caderno'
  ];

  const SITUACOES = [
    'Aula expositiva',
    'Explicação do conteúdo',
    'Atividade em sala',
    'Exposição e resolução de exercícios',
    'Leitura e discussão do conteúdo',
    'Explicação e atividade no caderno'
  ];

  let processando = false;

  // ============================================================
  // UTILIDADES
  // ============================================================

  function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function visivel(el) {
    if (!el) return false;

    const css = getComputedStyle(el);

    return (
      css.display !== 'none' &&
      css.visibility !== 'hidden' &&
      el.offsetParent !== null
    );
  }

  function dispararEventos(el) {
    el.dispatchEvent(
      new Event('input', {
        bubbles: true
      })
    );

    el.dispatchEvent(
      new Event('change', {
        bubbles: true
      })
    );

    el.dispatchEvent(
      new KeyboardEvent('keyup', {
        bubbles: true
      })
    );
  }

  async function aguardarCondicao(
    funcao,
    timeout = 10000,
    intervalo = 250
  ) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeout) {
      const resultado = funcao();

      if (resultado) {
        return resultado;
      }

      await esperar(intervalo);
    }

    return null;
  }

  function estaDepoisDe(a, b) {
    if (!a || !b) return false;

    return Boolean(
      a.compareDocumentPosition(b) &
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  }

  function normalizarTexto(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // ============================================================
  // ESTADO
  // ============================================================

  function salvarEstado(estado) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(estado)
    );

    atualizarStatus();
  }

  function obterEstado() {
    try {
      return JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );
    } catch {
      return null;
    }
  }

  function limparEstado() {
    localStorage.removeItem(STORAGE_KEY);

    atualizarStatus();
  }

  // ============================================================
  // DATAS
  // ============================================================

  function isoParaBR(data) {
    const p = data.split('-');

    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  function brParaISO(data) {
    const m = data.match(
      /^(\d{2})\/(\d{2})\/(\d{4})$/
    );

    if (!m) return null;

    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  function proximoDia(dataISO) {
    const [ano, mes, dia] =
      dataISO.split('-').map(Number);

    const data = new Date(
      ano,
      mes - 1,
      dia,
      12
    );

    data.setDate(
      data.getDate() + 1
    );

    return (
      data.getFullYear() +
      '-' +
      String(
        data.getMonth() + 1
      ).padStart(2, '0') +
      '-' +
      String(
        data.getDate()
      ).padStart(2, '0')
    );
  }

  function nomeDiaSemana(dataISO) {
    const [ano, mes, dia] =
      dataISO.split('-').map(Number);

    const data = new Date(
      ano,
      mes - 1,
      dia,
      12
    );

    const dias = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado'
    ];

    return dias[data.getDay()];
  }

  // ============================================================
  // CAMPO DATA
  // ============================================================

  function localizarCampoData() {
    return Array.from(
      document.querySelectorAll(
        'input[type="text"], input[type="date"]'
      )
    )
    .filter(el =>
      visivel(el) &&
      !el.closest('#sieoPainel')
    )
    .find(el => {
      const valor =
        (el.value || '').trim();

      return (
        /^\d{2}\/\d{2}\/\d{4}$/.test(valor) ||
        /^\d{4}-\d{2}-\d{2}$/.test(valor)
      );
    }) || null;
  }

  function obterDataPagina() {
    const campo =
      localizarCampoData();

    if (!campo) {
      return null;
    }

    const valor =
      campo.value.trim();

    if (
      /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ) {
      return valor;
    }

    if (
      /^\d{2}\/\d{2}\/\d{4}$/.test(valor)
    ) {
      return brParaISO(valor);
    }

    return null;
  }

  // ============================================================
  // BOTÕES << E >>
  // ============================================================

  function localizarBotaoData(direcao) {
    const textoAlvo =
      direcao === 'proximo'
        ? '>>'
        : '<<';

    return Array.from(
      document.querySelectorAll(
        `
        button,
        input[type="button"],
        input[type="submit"],
        a
        `
      )
    )
    .filter(el =>
      visivel(el) &&
      !el.closest('#sieoPainel')
    )
    .find(el => {
      const texto =
        (
          el.innerText ||
          el.value ||
          ''
        ).trim();

      return texto === textoAlvo;
    }) || null;
  }

  // ============================================================
  // CONFERE DIA DA SEMANA
  // ============================================================

  function paginaEstaNaDataCorreta(
    dataISO
  ) {
    if (
      obterDataPagina() !==
      dataISO
    ) {
      return false;
    }

    const texto =
      document.body.innerText || '';

    const resultado =
      texto.match(
        /Dia da semana:\s*([^\n\r]+)/i
      );

    /*
      Se a mensagem "Dia da semana" não aparece,
      normalmente a tela de aula foi carregada.
    */

    if (!resultado) {
      return true;
    }

    const correto =
      normalizarTexto(
        nomeDiaSemana(dataISO)
      );

    const tela =
      normalizarTexto(
        resultado[1]
      );

    return (
      tela.includes(correto) ||
      correto.includes(tela)
    );
  }

  // ============================================================
  // MOVIMENTA UM DIA PELO SIEO
  // ============================================================

  async function moverUmDia(
    direcao
  ) {
    const dataAntes =
      obterDataPagina();

    const botao =
      localizarBotaoData(
        direcao
      );

    if (!botao) {
      throw new Error(
        direcao === 'proximo'
          ? 'Botão >> não encontrado.'
          : 'Botão << não encontrado.'
      );
    }

    atualizarMensagem(
      direcao === 'proximo'
        ? 'Avançando para o próximo dia...'
        : 'Voltando um dia...'
    );

    botao.click();

    /*
      Espera o próprio SIEO alterar a data.
    */

    const novaData =
      await aguardarCondicao(
        () => {
          const atual =
            obterDataPagina();

          if (
            atual &&
            atual !== dataAntes
          ) {
            return atual;
          }

          return null;
        },
        15000,
        250
      );

    if (!novaData) {
      throw new Error(
        'O SIEO não atualizou a data.'
      );
    }

    atualizarMensagem(
      `Atualizando ${isoParaBR(novaData)}...`
    );

    /*
      Tempo para AJAX / atualização interna.
    */

    await esperar(1800);

    /*
      Agora confirma que a área da página
      realmente corresponde à nova data.
    */

    const atualizou =
      await aguardarCondicao(
        () =>
          paginaEstaNaDataCorreta(
            novaData
          ),
        12000,
        300
      );

    if (!atualizou) {
      throw new Error(
        `A data mudou para ${isoParaBR(novaData)}, mas a tela interna não atualizou corretamente.`
      );
    }

    await esperar(800);

    return novaData;
  }

  // ============================================================
  // GARANTE QUE A PÁGINA ESTÁ NA DATA CORRETA
  // ============================================================

  async function garantirData(
    dataAlvo
  ) {
    let atual =
      obterDataPagina();

    if (!atual) {
      throw new Error(
        'Data atual do SIEO não encontrada.'
      );
    }

    while (
      atual !== dataAlvo
    ) {
      if (
        atual < dataAlvo
      ) {
        atual =
          await moverUmDia(
            'proximo'
          );
      } else {
        atual =
          await moverUmDia(
            'anterior'
          );
      }
    }

    const correto =
      await aguardarCondicao(
        () =>
          paginaEstaNaDataCorreta(
            dataAlvo
          ),
        10000,
        300
      );

    if (!correto) {
      throw new Error(
        'A página não terminou de atualizar a data.'
      );
    }

    await esperar(1000);

    return true;
  }

  // ============================================================
  // POPUP
  // ============================================================

  function estaNoPopup(el) {
    if (!el) return false;

    const popup =
      el.closest(
        '.ui-dialog, [role="dialog"]'
      );

    if (!popup) {
      return false;
    }

    const texto =
      popup.innerText
        ?.toLowerCase() || '';

    return (
      texto.includes(
        'registro de habilidades'
      ) ||
      texto.includes(
        'selecione os itens ministrados'
      )
    );
  }

  // ============================================================
  // HORÁRIOS
  // ============================================================

  function localizarHorarios() {
    let horarios =
      Array.from(
        document.querySelectorAll(
          'input[type="checkbox"][class*="chkHorario"]'
        )
      )
      .filter(cb =>
        visivel(cb) &&
        !estaNoPopup(cb)
      );

    if (horarios.length) {
      return horarios;
    }

    return Array.from(
      document.querySelectorAll(
        'input[type="checkbox"]'
      )
    )
    .filter(cb => {
      if (
        !visivel(cb) ||
        estaNoPopup(cb)
      ) {
        return false;
      }

      const texto =
        (
          cb.parentElement?.innerText ||
          ''
        ) +
        ' ' +
        (
          cb.closest('tr')?.innerText ||
          ''
        );

      return (
        /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/
          .test(texto)
      );
    });
  }

  function marcarHorarios() {
    const horarios =
      localizarHorarios();

    horarios.forEach(cb => {
      if (!cb.checked) {
        cb.click();
      }
    });

    return horarios.length;
  }

  // ============================================================
  // BOTÃO DE HABILIDADES
  // ============================================================

  function localizarAdicionarHabilidades() {
    const botao =
      document.querySelector(
        'button[id^="btnAdicionarConteudoExibirEixosOrganizados"]'
      );

    if (
      botao &&
      visivel(botao)
    ) {
      return botao;
    }

    return null;
  }

  // ============================================================
  // JANELA REGISTRO DE HABILIDADES
  // ============================================================

  function localizarJanelaHabilidades() {
    const dialogs =
      Array.from(
        document.querySelectorAll(
          '.ui-dialog, [role="dialog"]'
        )
      )
      .filter(visivel);

    const dialog =
      dialogs.find(el => {
        const texto =
          el.innerText
            ?.toLowerCase() || '';

        return (
          texto.includes(
            'registro de habilidades'
          ) &&
          texto.includes(
            'ministrado'
          )
        );
      });

    if (dialog) {
      return dialog;
    }

    const candidatos =
      Array.from(
        document.querySelectorAll(
          'div'
        )
      )
      .filter(visivel)
      .filter(el => {
        const texto =
          el.innerText
            ?.toLowerCase() || '';

        return (
          texto.includes(
            'registro de habilidades'
          ) &&
          texto.includes(
            'selecione os itens ministrados'
          ) &&
          texto.includes(
            'ministrado'
          )
        );
      });

    candidatos.sort(
      (a, b) =>
        a.querySelectorAll('*').length -
        b.querySelectorAll('*').length
    );

    return candidatos[0] || null;
  }

  // ============================================================
  // LÊ TODOS OS CONTEÚDOS/HABILIDADES
  //
  // NÃO EXISTE QUANTIDADE FIXA.
  // ELE CONTA O QUE ESTIVER NA TABELA.
  // ============================================================

  function listarConteudosHabilidades(
    janela
  ) {
    const resultado = [];

    const linhas =
      Array.from(
        janela.querySelectorAll(
          'tr'
        )
      );

    for (
      const linha of linhas
    ) {
      const colunas =
        Array.from(
          linha.querySelectorAll(
            'td'
          )
        );

      /*
        Estrutura observada:

        0 = período
        1 = unidade temática
        2 = objeto de conhecimento
        3 = habilidade
        4 = ministrado
      */

      if (
        colunas.length < 5
      ) {
        continue;
      }

      const checkbox =
        colunas[4]
          .querySelector(
            'input[type="checkbox"]'
          ) ||
        linha.querySelector(
          'input[type="checkbox"]'
        );

      if (
        !checkbox ||
        checkbox.disabled
      ) {
        continue;
      }

      const habilidade =
        colunas[3]
          ?.innerText
          ?.trim() || '';

      /*
        Só ignora linha realmente vazia
        ou cabeçalho.
      */

      if (!habilidade) {
        continue;
      }

      if (
        normalizarTexto(
          habilidade
        ) === 'habilidade'
      ) {
        continue;
      }

      resultado.push({
        linha,
        checkbox,

        periodo:
          colunas[0]
            ?.innerText
            ?.trim() || '',

        unidade:
          colunas[1]
            ?.innerText
            ?.trim() || '',

        objeto:
          colunas[2]
            ?.innerText
            ?.trim() || '',

        habilidade
      });
    }

    return resultado;
  }

  // ============================================================
  // ESPERA A LISTA TERMINAR DE CARREGAR
  //
  // Conta várias vezes até a quantidade estabilizar.
  // ============================================================

  async function aguardarListaCompleta(
    janela
  ) {
    let quantidadeAnterior = -1;
    let repeticoesIguais = 0;
    let itens = [];

    while (true) {
      itens =
        listarConteudosHabilidades(
          janela
        );

      const quantidade =
        itens.length;

      if (
        quantidade > 0 &&
        quantidade === quantidadeAnterior
      ) {
        repeticoesIguais++;
      } else {
        repeticoesIguais = 0;
      }

      /*
        Depois de algumas leituras iguais,
        consideramos que terminou de carregar.
      */

      if (
        quantidade > 0 &&
        repeticoesIguais >= 3
      ) {
        return itens;
      }

      quantidadeAnterior =
        quantidade;

      await esperar(350);

      /*
        Se a janela fechar inesperadamente,
        interrompe.
      */

      if (
        !localizarJanelaHabilidades()
      ) {
        return [];
      }
    }
  }

  // ============================================================
  // CONTROLE DA SEQUÊNCIA
  //
  // Exemplo com 5 itens:
  //
  // 1 -> 2 -> 3 -> 4 -> 5 -> 4 -> 3 -> 2 -> 1 -> 2...
  //
  // A quantidade é descoberta automaticamente.
  // ============================================================

  function obterPosicaoConteudo(
    estado,
    total
  ) {
    if (
      total <= 1
    ) {
      return {
        indice: 0,
        direcao: 1
      };
    }

    let indice =
      Number.isInteger(
        estado.indiceConteudo
      )
        ? estado.indiceConteudo
        : 0;

    let direcao =
      estado.direcaoConteudo === -1
        ? -1
        : 1;

    /*
      Caso a matéria/lista mude e tenha
      outra quantidade de itens, ajusta
      automaticamente para uma posição válida.
    */

    if (
      indice < 0 ||
      indice >= total
    ) {
      indice = 0;
      direcao = 1;
    }

    return {
      indice,
      direcao
    };
  }

  function avancarPosicaoConteudo(
    estado,
    total
  ) {
    if (
      total <= 1
    ) {
      estado.indiceConteudo = 0;
      estado.direcaoConteudo = 1;

      return;
    }

    const atual =
      obterPosicaoConteudo(
        estado,
        total
      );

    let indice =
      atual.indice;

    let direcao =
      atual.direcao;

    let proximo =
      indice + direcao;

    /*
      Chegou no último:
      começa a voltar.
    */

    if (
      proximo >= total
    ) {
      direcao = -1;

      proximo =
        total - 2;
    }

    /*
      Chegou no primeiro:
      começa a subir de novo.
    */

    if (
      proximo < 0
    ) {
      direcao = 1;

      proximo = 1;
    }

    estado.indiceConteudo =
      proximo;

    estado.direcaoConteudo =
      direcao;
  }

  // ============================================================
  // CONFIRMAR
  // ============================================================

  function localizarConfirmar(
    janela
  ) {
    return Array.from(
      janela.querySelectorAll(
        `
        button,
        a,
        input[type="button"],
        input[type="submit"]
        `
      )
    )
    .filter(visivel)
    .find(el => {
      const texto =
        (
          el.innerText ||
          el.value ||
          ''
        )
        .trim()
        .toUpperCase();

      return (
        texto.includes(
          'CONFIRMAR'
        )
      );
    }) || null;
  }

  // ============================================================
  // SELECIONA O ITEM CORRETO
  // ============================================================

  async function selecionarHabilidade(
    estado
  ) {
    const adicionar =
      localizarAdicionarHabilidades();

    if (!adicionar) {
      throw new Error(
        'ADICIONAR do Registro de habilidades não encontrado.'
      );
    }

    atualizarMensagem(
      'Abrindo Registro de habilidades...'
    );

    adicionar.click();

    await esperar(2500);

    const janela =
      await aguardarCondicao(
        localizarJanelaHabilidades,
        15000,
        300
      );

    if (!janela) {
      throw new Error(
        'Registro de habilidades não abriu.'
      );
    }

    atualizarMensagem(
      'Analisando e contando conteúdos...'
    );

    /*
      AQUI ELE CONTA AUTOMATICAMENTE
      TODOS OS ITENS DA TABELA.
    */

    const itens =
      await aguardarListaCompleta(
        janela
      );

    const total =
      itens.length;

    if (!total) {
      throw new Error(
        'Nenhum conteúdo/habilidade foi encontrado.'
      );
    }

    const posicao =
      obterPosicaoConteudo(
        estado,
        total
      );

    const indice =
      posicao.indice;

    const item =
      itens[indice];

    if (!item) {
      throw new Error(
        'Não consegui localizar o item selecionado.'
      );
    }

    atualizarMensagem(
      `Selecionando item ${indice + 1} de ${total}...`
    );

    console.log(
      `[SIEO] Foram encontrados ${total} conteúdos/habilidades.`
    );

    console.log(
      `[SIEO] Selecionando posição ${indice + 1} de ${total}.`
    );

    console.log(
      '[SIEO] Habilidade:',
      item.habilidade
    );

    /*
      Copia o texto ANTES de fechar a janela.
    */

    const habilidade =
      item.habilidade.trim();

    item.checkbox.scrollIntoView({
      block: 'center'
    });

    await esperar(400);

    /*
      Garante que o item escolhido esteja marcado.
    */

    if (
      !item.checkbox.checked
    ) {
      item.checkbox.click();

      await esperar(700);
    }

    if (
      !item.checkbox.checked
    ) {
      item.checkbox.click();

      await esperar(500);
    }

    if (
      !item.checkbox.checked
    ) {
      throw new Error(
        `Não consegui marcar o item ${indice + 1}.`
      );
    }

    const confirmar =
      localizarConfirmar(
        janela
      );

    if (!confirmar) {
      throw new Error(
        'Botão CONFIRMAR não encontrado.'
      );
    }

    atualizarMensagem(
      `Confirmando item ${indice + 1} de ${total}...`
    );

    confirmar.click();

    await esperar(3000);

    const fechou =
      await aguardarCondicao(
        () =>
          !localizarJanelaHabilidades(),
        10000,
        300
      );

    if (!fechou) {
      throw new Error(
        'A janela de habilidades não fechou após CONFIRMAR.'
      );
    }

    await esperar(1000);

    /*
      Não avança a posição aqui.

      Só avançamos depois que GRAVAR
      funcionar, para não perder a sequência
      caso o dia dê erro.
    */

    return {
      habilidade,
      totalItens: total,
      indiceUsado: indice
    };
  }

  // ============================================================
  // CONTEÚDO
  // ============================================================

  function localizarCampoConteudo() {
    let campo =
      document.querySelector(
        'textarea[id^="txtConteudoSituacaoDidatica"]'
      );

    if (
      campo &&
      visivel(campo)
    ) {
      return campo;
    }

    const textareas =
      Array.from(
        document.querySelectorAll(
          'textarea'
        )
      )
      .filter(el =>
        visivel(el) &&
        !estaNoPopup(el)
      );

    return textareas.find(el => {
      const id =
        (el.id || '')
          .toLowerCase();

      const nome =
        (el.name || '')
          .toLowerCase();

      return (
        id.includes('conteudo') ||
        nome.includes('conteudo')
      );
    }) || textareas[0] || null;
  }

  function preencherConteudo(
    habilidade
  ) {
    const campo =
      localizarCampoConteudo();

    if (!campo) {
      return false;
    }

    let texto =
      habilidade.trim();

    if (
      texto.length >
      LIMITE_CONTEUDO
    ) {
      texto =
        texto.substring(
          0,
          LIMITE_CONTEUDO
        );
    }

    campo.focus();

    campo.value = texto;

    dispararEventos(campo);

    campo.blur();

    return (
      campo.value.trim().length > 0
    );
  }

  // ============================================================
  // SELECTS
  // ============================================================

  function localizarSelectPorTexto(
    textoAlvo
  ) {
    const alvo =
      normalizarTexto(
        textoAlvo
      );

    const selects =
      Array.from(
        document.querySelectorAll(
          'select'
        )
      )
      .filter(el =>
        visivel(el) &&
        !estaNoPopup(el)
      );

    for (
      const select of selects
    ) {
      let pai =
        select.parentElement;

      for (
        let i = 0;
        i < 5 && pai;
        i++
      ) {
        const texto =
          normalizarTexto(
            pai.innerText || ''
          );

        if (
          texto.includes(alvo)
        ) {
          return select;
        }

        pai =
          pai.parentElement;
      }
    }

    return null;
  }

  function localizarSelectRecurso() {
    const especifico =
      document.querySelector(
        'select[id^="ddlRecursoDidatico"]'
      );

    if (
      especifico &&
      visivel(especifico)
    ) {
      return especifico;
    }

    return localizarSelectPorTexto(
      'recurso didático'
    );
  }

  function localizarSelectSituacao() {
    const especifico =
      document.querySelector(
        'select[id^="ddlSituacaoDidatica"]'
      );

    if (
      especifico &&
      visivel(especifico)
    ) {
      return especifico;
    }

    return localizarSelectPorTexto(
      'situação didática'
    );
  }

  async function selecionarOutros(
    select
  ) {
    if (!select) {
      return false;
    }

    const opcao =
      Array.from(
        select.options
      )
      .find(op =>
        normalizarTexto(
          op.textContent
        ) === 'outros'
      );

    if (!opcao) {
      return false;
    }

    select.value =
      opcao.value;

    dispararEventos(select);

    await esperar(700);

    return true;
  }

  // ============================================================
  // INPUT ENTRE ELEMENTOS
  // ============================================================

  function localizarCampoEntre(
    inicio,
    fim
  ) {
    const inputs =
      Array.from(
        document.querySelectorAll(
          'input[type="text"]'
        )
      )
      .filter(el =>
        visivel(el) &&
        el !== localizarCampoData() &&
        !estaNoPopup(el)
      );

    return inputs.find(input => {
      if (
        !estaDepoisDe(
          inicio,
          input
        )
      ) {
        return false;
      }

      if (!fim) {
        return true;
      }

      return estaDepoisDe(
        input,
        fim
      );
    }) || null;
  }

  function escreverCampo(
    campo,
    texto
  ) {
    if (!campo) {
      return false;
    }

    campo.focus();

    campo.value = texto;

    dispararEventos(campo);

    campo.blur();

    return (
      campo.value.trim().length > 0
    );
  }

  // ============================================================
  // ADICIONAR
  // ============================================================

  function localizarBotoesAdicionar() {
    return Array.from(
      document.querySelectorAll(
        `
        button,
        a,
        input[type="button"],
        input[type="submit"]
        `
      )
    )
    .filter(visivel)
    .filter(el => {
      if (estaNoPopup(el)) {
        return false;
      }

      const texto =
        (
          el.innerText ||
          el.value ||
          ''
        )
        .trim()
        .toUpperCase();

      return (
        texto.includes(
          'ADICIONAR'
        )
      );
    });
  }

  function localizarAdicionarRecurso(
    campoRecurso,
    situacao
  ) {
    return localizarBotoesAdicionar()
      .find(botao => {
        if (
          String(
            botao.id || ''
          ).startsWith(
            'btnAdicionarConteudoExibirEixosOrganizados'
          )
        ) {
          return false;
        }

        return (
          estaDepoisDe(
            campoRecurso,
            botao
          ) &&
          estaDepoisDe(
            botao,
            situacao
          )
        );
      }) || null;
  }

  function localizarAdicionarFinal(
    situacao
  ) {
    const botoes =
      localizarBotoesAdicionar()
        .filter(botao => {
          if (
            String(
              botao.id || ''
            ).startsWith(
              'btnAdicionarConteudoExibirEixosOrganizados'
            )
          ) {
            return false;
          }

          return estaDepoisDe(
            situacao,
            botao
          );
        });

    return (
      botoes[
        botoes.length - 1
      ] ||
      null
    );
  }

  // ============================================================
  // RECURSO + SITUAÇÃO
  // ============================================================

  async function preencherRecursoSituacao(
    indiceVariacao
  ) {
    let recurso =
      localizarSelectRecurso();

    let situacao =
      localizarSelectSituacao();

    if (!recurso) {
      throw new Error(
        'Recurso didático não encontrado.'
      );
    }

    if (!situacao) {
      throw new Error(
        'Situação didática não encontrada.'
      );
    }

    // ========================================================
    // RECURSO
    // ========================================================

    atualizarMensagem(
      'Preenchendo Recurso didático...'
    );

    if (
      !await selecionarOutros(
        recurso
      )
    ) {
      throw new Error(
        'Não consegui selecionar Outros no Recurso didático.'
      );
    }

    await esperar(600);

    const campoRecurso =
      localizarCampoEntre(
        recurso,
        situacao
      );

    if (!campoRecurso) {
      throw new Error(
        'Campo do Recurso didático não encontrado.'
      );
    }

    const textoRecurso =
      RECURSOS[
        indiceVariacao %
        RECURSOS.length
      ];

    if (
      !escreverCampo(
        campoRecurso,
        textoRecurso
      )
    ) {
      throw new Error(
        'Não consegui escrever o Recurso didático.'
      );
    }

    await esperar(700);

    const adicionarRecurso =
      localizarAdicionarRecurso(
        campoRecurso,
        situacao
      );

    if (!adicionarRecurso) {
      throw new Error(
        'ADICIONAR do Recurso didático não encontrado.'
      );
    }

    atualizarMensagem(
      'Adicionando Recurso didático...'
    );

    adicionarRecurso.click();

    /*
      Espera o SIEO adicionar o recurso.
    */

    await esperar(1500);

    /*
      Depois do AJAX, procura Situação novamente,
      porque o SIEO pode reconstruir os elementos.
    */

    situacao =
      localizarSelectSituacao();

    if (!situacao) {
      throw new Error(
        'Situação didática desapareceu após adicionar o recurso.'
      );
    }

    // ========================================================
    // SITUAÇÃO
    // ========================================================

    atualizarMensagem(
      'Preenchendo Situação didática...'
    );

    if (
      !await selecionarOutros(
        situacao
      )
    ) {
      throw new Error(
        'Não consegui selecionar Outros na Situação didática.'
      );
    }

    await esperar(600);

    const campoSituacao =
      localizarCampoEntre(
        situacao,
        null
      );

    if (!campoSituacao) {
      throw new Error(
        'Campo da Situação didática não encontrado.'
      );
    }

    const textoSituacao =
      SITUACOES[
        indiceVariacao %
        SITUACOES.length
      ];

    if (
      !escreverCampo(
        campoSituacao,
        textoSituacao
      )
    ) {
      throw new Error(
        'Não consegui escrever a Situação didática.'
      );
    }

    await esperar(700);

    return {
      situacao,
      campoSituacao
    };
  }

  // ============================================================
  // GRAVAR
  // ============================================================

  function localizarGravar() {
    const especifico =
      document.querySelector(
        'button[id^="btnGravar"], input[id^="btnGravar"]'
      );

    if (
      especifico &&
      visivel(especifico)
    ) {
      return especifico;
    }

    return Array.from(
      document.querySelectorAll(
        `
        button,
        a,
        input[type="button"],
        input[type="submit"]
        `
      )
    )
    .filter(visivel)
    .find(el => {
      const texto =
        (
          el.innerText ||
          el.value ||
          ''
        )
        .trim()
        .toUpperCase();

      return (
        texto.includes(
          'GRAVAR'
        )
      );
    }) || null;
  }

  // ============================================================
  // EXECUTA UM DIA
  // ============================================================

  async function executarDia(
    estado
  ) {
    const dataAtual =
      estado.dataAtual;

    /*
      Confirma novamente a data.
    */

    if (
      obterDataPagina() !==
      dataAtual
    ) {
      throw new Error(
        'A data exibida pelo SIEO não corresponde à data atual da automação.'
      );
    }

    atualizarMensagem(
      `Verificando ${isoParaBR(dataAtual)}...`
    );

    await esperar(1500);

    const horarios =
      localizarHorarios();

    // ========================================================
    // SEM AULA
    // ========================================================

    if (!horarios.length) {
      console.log(
        `[SIEO] ⏭ Sem aula em ${isoParaBR(dataAtual)}`
      );

      estado.pulados =
        (estado.pulados || 0) + 1;

      estado.dataAtual =
        proximoDia(
          dataAtual
        );

      salvarEstado(
        estado
      );

      return;
    }

    // ========================================================
    // HORÁRIOS
    // ========================================================

    marcarHorarios();

    await esperar(800);

    // ========================================================
    // HABILIDADE
    //
    // ELE CONTA A LISTA E ESCOLHE A POSIÇÃO CORRETA.
    // ========================================================

    const selecao =
      await selecionarHabilidade(
        estado
      );

    const habilidade =
      selecao.habilidade;

    const totalItens =
      selecao.totalItens;

    // ========================================================
    // CONTEÚDO
    // ========================================================

    atualizarMensagem(
      `Copiando habilidade ${selecao.indiceUsado + 1} de ${totalItens}...`
    );

    if (
      !preencherConteudo(
        habilidade
      )
    ) {
      throw new Error(
        'Conteúdos trabalhados não foi preenchido.'
      );
    }

    await esperar(700);

    // ========================================================
    // RECURSO + ADICIONAR RECURSO + SITUAÇÃO
    // ========================================================

    const campos =
      await preencherRecursoSituacao(
        estado.concluidos || 0
      );

    // ========================================================
    // ESPERA 1,5s
    // ========================================================

    atualizarMensagem(
      'Tudo preenchido. Aguardando 1,5 s...'
    );

    await esperar(1500);

    // ========================================================
    // ADICIONAR FINAL
    // ========================================================

    const adicionarFinal =
      localizarAdicionarFinal(
        campos.situacao
      );

    if (!adicionarFinal) {
      throw new Error(
        'ADICIONAR final não encontrado.'
      );
    }

    atualizarMensagem(
      'Adicionando situação didática...'
    );

    adicionarFinal.click();

    await esperar(2000);

    // ========================================================
    // GRAVAR
    // ========================================================

    const gravar =
      localizarGravar();

    if (!gravar) {
      throw new Error(
        'Botão GRAVAR não encontrado.'
      );
    }

    atualizarMensagem(
      'Gravando...'
    );

    gravar.click();

    await esperar(3000);

    console.log(
      `[SIEO] ✅ ${isoParaBR(dataAtual)} salvo.`
    );

    /*
      IMPORTANTE:

      Só agora, depois de GRAVAR,
      passa para o próximo conteúdo.

      Assim, se der erro no dia,
      ele não perde a posição.
    */

    avancarPosicaoConteudo(
      estado,
      totalItens
    );

    estado.concluidos =
      (estado.concluidos || 0) + 1;

    estado.dataAtual =
      proximoDia(
        dataAtual
      );

    salvarEstado(
      estado
    );
  }

  // ============================================================
  // ERROS
  // ============================================================

  function registrarErroEContinuar(
    estado,
    data,
    erro
  ) {
    if (!estado.erros) {
      estado.erros = [];
    }

    estado.erros.push({
      data,
      mensagem:
        erro?.message ||
        String(erro)
    });

    console.error(
      `[SIEO] ❌ ${isoParaBR(data)}:`,
      erro
    );

    /*
      Mantém a mesma posição do conteúdo.
      Só muda a data.
    */

    estado.dataAtual =
      proximoDia(
        data
      );

    salvarEstado(
      estado
    );
  }

  // ============================================================
  // MOTOR PRINCIPAL
  // ============================================================

  async function executar() {
    if (processando) {
      return;
    }

    if (
      !obterEstado()?.ativo
    ) {
      return;
    }

    processando = true;

    try {
      while (true) {
        let estado =
          obterEstado();

        if (
          !estado ||
          !estado.ativo
        ) {
          break;
        }

        // ====================================================
        // FINAL
        // ====================================================

        if (
          estado.dataAtual >
          estado.dataFim
        ) {
          const concluidos =
            estado.concluidos || 0;

          const pulados =
            estado.pulados || 0;

          const erros =
            estado.erros || [];

          limparEstado();

          let mensagem =
            'Teste 1 - SIEO concluído!\n\n' +
            `✅ Dias salvos: ${concluidos}\n` +
            `⏭ Dias sem aula: ${pulados}\n` +
            `⚠ Dias com erro: ${erros.length}`;

          if (
            erros.length
          ) {
            mensagem +=
              '\n\nDatas com erro:\n';

            erros.forEach(item => {
              mensagem +=
                `• ${isoParaBR(item.data)}\n`;
            });
          }

          alert(
            mensagem
          );

          break;
        }

        const dataAlvo =
          estado.dataAtual;

        try {
          // ==================================================
          // GARANTE DATA CORRETA
          // ==================================================

          await garantirData(
            dataAlvo
          );

          if (
            obterDataPagina() !==
            dataAlvo
          ) {
            throw new Error(
              'Data do SIEO diferente da data que deveria ser processada.'
            );
          }

          atualizarMensagem(
            `Carregando ${isoParaBR(dataAlvo)}...`
          );

          await esperar(1800);

          estado =
            obterEstado();

          if (!estado) {
            break;
          }

          await executarDia(
            estado
          );

          await esperar(1200);

        } catch (erro) {
          estado =
            obterEstado();

          if (!estado) {
            break;
          }

          registrarErroEContinuar(
            estado,
            dataAlvo,
            erro
          );

          await esperar(1200);
        }
      }

    } finally {
      processando = false;
    }
  }

  // ============================================================
  // STATUS
  // ============================================================

  function atualizarMensagem(texto) {
    const status =
      document.getElementById(
        'sieoStatusTeste1'
      );

    if (!status) {
      return;
    }

    status.style.display =
      'block';

    status.textContent =
      '⏳ ' + texto;
  }

  function atualizarStatus() {
    const status =
      document.getElementById(
        'sieoStatusTeste1'
      );

    if (!status) {
      return;
    }

    const estado =
      obterEstado();

    if (
      estado?.ativo
    ) {
      status.style.display =
        'block';

      const numeroConteudo =
        Number.isInteger(
          estado.indiceConteudo
        )
          ? estado.indiceConteudo + 1
          : 1;

      status.textContent =
        `⏳ Próxima data: ${isoParaBR(estado.dataAtual)} | posição: ${numeroConteudo}`;

    } else {
      status.style.display =
        'none';
    }
  }

  // ============================================================
  // BOTÃO
  // ============================================================

  function criarBotao() {
    if (
      document.getElementById(
        'sieoBotaoTeste1'
      )
    ) {
      return;
    }

    const botao =
      document.createElement(
        'button'
      );

    botao.id =
      'sieoBotaoTeste1';

    botao.textContent =
      '📘 Teste 1 - SIEO Automático';

    Object.assign(
      botao.style,
      {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: '999999',

        padding:
          '12px 18px',

        border:
          'none',

        borderRadius:
          '8px',

        background:
          '#087bb8',

        color:
          '#fff',

        fontWeight:
          'bold',

        cursor:
          'pointer',

        boxShadow:
          '0 2px 9px rgba(0,0,0,.3)'
      }
    );

    botao.onclick =
      abrirPainel;

    document.body.appendChild(
      botao
    );

    const status =
      document.createElement(
        'div'
      );

    status.id =
      'sieoStatusTeste1';

    Object.assign(
      status.style,
      {
        position: 'fixed',
        bottom: '78px',
        right: '24px',
        zIndex: '999999',

        background:
          '#1f2937',

        color:
          '#fff',

        padding:
          '8px 12px',

        borderRadius:
          '6px',

        fontSize:
          '12px',

        fontFamily:
          'Arial',

        display:
          'none',

        maxWidth:
          '390px'
      }
    );

    document.body.appendChild(
      status
    );

    atualizarStatus();
  }

  // ============================================================
  // PAINEL
  // ============================================================

  function abrirPainel() {
    if (
      document.getElementById(
        'sieoPainel'
      )
    ) {
      return;
    }

    const dataAtual =
      obterDataPagina() || '';

    const painel =
      document.createElement(
        'div'
      );

    painel.id =
      'sieoPainel';

    Object.assign(
      painel.style,
      {
        position: 'fixed',
        top: '50%',
        left: '50%',

        transform:
          'translate(-50%, -50%)',

        zIndex:
          '1000000',

        width:
          '420px',

        maxWidth:
          '90vw',

        padding:
          '20px',

        background:
          '#1f2937',

        color:
          '#fff',

        borderRadius:
          '10px',

        boxShadow:
          '0 4px 20px rgba(0,0,0,.5)',

        fontFamily:
          'Arial, sans-serif'
      }
    );

    painel.innerHTML = `

      <h3 style="margin:0 0 8px;">
        Teste 1 - SIEO Automático
      </h3>

      <div style="
        font-size:12px;
        color:#d1d5db;
        line-height:1.5;
        margin-bottom:15px;
      ">
        O script conta automaticamente os conteúdos
        disponíveis e percorre a lista em ordem,
        voltando em ordem inversa quando chegar ao final.
      </div>

      <label style="
        display:block;
        font-size:12px;
        margin-bottom:4px;
      ">
        Data inicial
      </label>

      <input
        id="sieoInicio"
        type="date"
        value="${dataAtual}"
        style="
          width:100%;
          box-sizing:border-box;
          padding:7px;
          margin-bottom:12px;
        "
      >

      <label style="
        display:block;
        font-size:12px;
        margin-bottom:4px;
      ">
        Data final
      </label>

      <input
        id="sieoFim"
        type="date"
        value="${dataAtual}"
        style="
          width:100%;
          box-sizing:border-box;
          padding:7px;
          margin-bottom:16px;
        "
      >

      <div style="
        display:flex;
        justify-content:flex-end;
        gap:8px;
      ">

        ${
          obterEstado()?.ativo
            ? `
            <button
              id="sieoParar"
              style="
                padding:8px 12px;
                border:none;
                border-radius:6px;
                background:#dc2626;
                color:white;
                cursor:pointer;
              "
            >
              ⏹ Parar
            </button>
            `
            : ''
        }

        <button
          id="sieoCancelar"
          style="
            padding:8px 12px;
            border:none;
            border-radius:6px;
            background:#4b5563;
            color:#fff;
            cursor:pointer;
          "
        >
          Cancelar
        </button>

        <button
          id="sieoIniciar"
          style="
            padding:8px 12px;
            border:none;
            border-radius:6px;
            background:#16a34a;
            color:#fff;
            cursor:pointer;
            font-weight:bold;
          "
        >
          ▶ Iniciar
        </button>

      </div>
    `;

    document.body.appendChild(
      painel
    );

    document.getElementById(
      'sieoCancelar'
    ).onclick =
      () =>
        painel.remove();

    const parar =
      document.getElementById(
        'sieoParar'
      );

    if (parar) {
      parar.onclick =
        () => {
          limparEstado();

          painel.remove();

          alert(
            'Automação interrompida.'
          );
        };
    }

    document.getElementById(
      'sieoIniciar'
    ).onclick =
      iniciarAutomacao;
  }

  // ============================================================
  // INICIAR
  // ============================================================

  function iniciarAutomacao() {
    const inicio =
      document.getElementById(
        'sieoInicio'
      ).value;

    const fim =
      document.getElementById(
        'sieoFim'
      ).value;

    if (
      !inicio ||
      !fim
    ) {
      alert(
        'Informe a data inicial e final.'
      );

      return;
    }

    if (
      inicio > fim
    ) {
      alert(
        'A data inicial não pode ser maior que a final.'
      );

      return;
    }

    /*
      Cada nova execução começa
      no primeiro item da lista.

      Não importa qual matéria esteja selecionada.
    */

    salvarEstado({
      ativo: true,

      dataAtual:
        inicio,

      dataFim:
        fim,

      concluidos:
        0,

      pulados:
        0,

      erros:
        [],

      /*
        Sequência dinâmica dos conteúdos.
      */

      indiceConteudo:
        0,

      direcaoConteudo:
        1
    });

    document.getElementById(
      'sieoPainel'
    )?.remove();

    executar();
  }

  // ============================================================
  // START
  // ============================================================

  window.addEventListener(
    'load',
    () => {
      criarBotao();

      /*
        Se o SIEO recarregar,
        continua usando o estado salvo.
      */

      const estado =
        obterEstado();

      if (
        estado?.ativo
      ) {
        setTimeout(
          executar,
          2500
        );
      }
    }
  );

})();
