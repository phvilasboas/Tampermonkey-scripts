// ==UserScript==
// @name         Aplicador de Cupons Mercado Livre
// @namespace    pedro-automacoes
// @version      1.0
// @description  Aplica os cupons disponíveis e percorre todas as páginas
// @match        https://www.mercadolivre.com.br/cupons*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";

    const CHAVES = {
        ativo: "mlCuponsAtivo",
        total: "mlCuponsTotal",
        paginas: "mlCuponsPaginas",
        visitadas: "mlCuponsVisitadas"
    };

    const CONFIGURACAO = {
        intervaloMinimo: 1800,
        intervaloMaximo: 2800,
        esperaInicial: 2500,
        esperaSemBotoes: 1500,
        maximoCliquesPorPagina: 200,
        maximoPaginas: 100
    };

    let executando = false;
    let elementoStatus;

    const esperar = (tempo) =>
        new Promise((resolve) => setTimeout(resolve, tempo));

    const intervaloAleatorio = () =>
        Math.floor(
            Math.random() *
                (
                    CONFIGURACAO.intervaloMaximo -
                    CONFIGURACAO.intervaloMinimo +
                    1
                )
        ) + CONFIGURACAO.intervaloMinimo;

    const estaAtivo = () =>
        sessionStorage.getItem(CHAVES.ativo) === "true";

    const definirAtivo = (valor) =>
        sessionStorage.setItem(CHAVES.ativo, String(valor));

    const obterNumero = (chave) =>
        Number(sessionStorage.getItem(chave)) || 0;

    const definirNumero = (chave, valor) =>
        sessionStorage.setItem(chave, String(valor));

    const obterVisitadas = () => {
        try {
            return JSON.parse(
                sessionStorage.getItem(CHAVES.visitadas) || "[]"
            );
        } catch {
            return [];
        }
    };

    const definirVisitadas = (paginas) =>
        sessionStorage.setItem(
            CHAVES.visitadas,
            JSON.stringify(paginas)
        );

    const definirStatus = (mensagem) => {
        console.log(`[Cupons ML] ${mensagem}`);

        if (elementoStatus) {
            elementoStatus.textContent = mensagem;
        }
    };

    const obterPaginaAtual = () => {
        const url = new URL(window.location.href);
        return Number(url.searchParams.get("page")) || 1;
    };

    const obterBotoesAplicar = () => {
        return Array.from(
            document.querySelectorAll(
                'span.andes-button__text[data-andes-button-text="true"]'
            )
        )
            .filter(
                (elemento) =>
                    elemento.textContent.trim().toLowerCase() ===
                    "aplicar"
            )
            .map((elemento) => elemento.closest("button, a"))
            .filter((botao) => {
                if (!botao) return false;
                if (botao.disabled) return false;

                if (botao.getAttribute("aria-disabled") === "true") {
                    return false;
                }

                if (botao.dataset.cupomProcessado === "true") {
                    return false;
                }

                return true;
            });
    };

    const obterProximaPagina = () => {
        const botao = document.querySelector(
            'a[data-andes-pagination-control="next"]'
        );

        if (!botao || !botao.href) {
            return null;
        }

        if (botao.getAttribute("aria-disabled") === "true") {
            return null;
        }

        const item = botao.closest("li");

        if (
            item &&
            item.classList.contains(
                "andes-pagination__button--disabled"
            )
        ) {
            return null;
        }

        return botao.href;
    };

    const atualizarResumo = (adicionadosPagina) => {
        const totalAnterior = obterNumero(CHAVES.total);
        const paginasAnteriores = obterNumero(CHAVES.paginas);

        definirNumero(
            CHAVES.total,
            totalAnterior + adicionadosPagina
        );

        definirNumero(
            CHAVES.paginas,
            paginasAnteriores + 1
        );
    };

    const finalizar = (mensagem) => {
        definirAtivo(false);

        definirStatus(
            `${mensagem} Total acionado: ` +
            `${obterNumero(CHAVES.total)} cupom(ns) em ` +
            `${obterNumero(CHAVES.paginas)} página(s).`
        );
    };

    const processarPagina = async () => {
        if (executando || !estaAtivo()) {
            return;
        }

        executando = true;

        try {
            await esperar(CONFIGURACAO.esperaInicial);

            const paginaAtual = obterPaginaAtual();
            const urlAtual = window.location.href;
            const visitadas = obterVisitadas();

            if (visitadas.includes(urlAtual)) {
                finalizar(
                    "Página já processada. Automação encerrada."
                );
                return;
            }

            if (
                obterNumero(CHAVES.paginas) >=
                CONFIGURACAO.maximoPaginas
            ) {
                finalizar(
                    "Limite máximo de páginas atingido."
                );
                return;
            }

            definirStatus(
                `Processando a página ${paginaAtual}...`
            );

            let cliquesPagina = 0;
            let rodadasSemBotoes = 0;

            while (
                rodadasSemBotoes < 3 &&
                cliquesPagina <
                    CONFIGURACAO.maximoCliquesPorPagina
            ) {
                if (!estaAtivo()) {
                    definirStatus("Automação interrompida.");
                    return;
                }

                const botoes = obterBotoesAplicar();

                if (botoes.length === 0) {
                    rodadasSemBotoes++;

                    window.scrollTo({
                        top: document.body.scrollHeight,
                        behavior: "smooth"
                    });

                    await esperar(
                        CONFIGURACAO.esperaSemBotoes
                    );

                    continue;
                }

                rodadasSemBotoes = 0;

                for (const botao of botoes) {
                    if (!estaAtivo()) {
                        definirStatus("Automação interrompida.");
                        return;
                    }

                    if (
                        cliquesPagina >=
                        CONFIGURACAO.maximoCliquesPorPagina
                    ) {
                        break;
                    }

                    botao.dataset.cupomProcessado = "true";

                    botao.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

                    await esperar(400);

                    try {
                        botao.click();
                        cliquesPagina++;

                        definirStatus(
                            `Página ${paginaAtual}: ` +
                            `${cliquesPagina} cupom(ns) acionado(s).`
                        );
                    } catch (erro) {
                        console.error(
                            "[Cupons ML] Falha ao clicar:",
                            erro
                        );
                    }

                    await esperar(intervaloAleatorio());
                }
            }

            visitadas.push(urlAtual);
            definirVisitadas(visitadas);
            atualizarResumo(cliquesPagina);

            const proximaPagina = obterProximaPagina();

            if (!proximaPagina) {
                finalizar("Última página concluída.");
                return;
            }

            if (visitadas.includes(proximaPagina)) {
                finalizar(
                    "A próxima página já foi processada."
                );
                return;
            }

            definirStatus(
                `Página ${paginaAtual} concluída. ` +
                "Carregando a próxima..."
            );

            await esperar(2000);

            window.location.assign(proximaPagina);
        } catch (erro) {
            console.error("[Cupons ML] Erro:", erro);
            finalizar("Ocorreu um erro durante a execução.");
        } finally {
            executando = false;
        }
    };

    const iniciar = () => {
        sessionStorage.removeItem(CHAVES.total);
        sessionStorage.removeItem(CHAVES.paginas);
        sessionStorage.removeItem(CHAVES.visitadas);

        definirAtivo(true);
        definirStatus("Automação iniciada.");

        processarPagina();
    };

    const parar = () => {
        definirAtivo(false);
        definirStatus(
            `Automação interrompida. Total acionado: ` +
            `${obterNumero(CHAVES.total)} cupom(ns).`
        );
    };

    const criarPainel = () => {
        if (document.getElementById("ml-aplicador-cupons")) {
            return;
        }

        const painel = document.createElement("div");
        painel.id = "ml-aplicador-cupons";

        painel.style.cssText = `
            position: fixed;
            right: 20px;
            bottom: 20px;
            z-index: 999999;
            width: 280px;
            padding: 15px;
            color: #222;
            background: #fff;
            border: 2px solid #3483fa;
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;

        const titulo = document.createElement("strong");
        titulo.textContent = "Aplicador de cupons";

        elementoStatus = document.createElement("div");
        elementoStatus.style.cssText = `
            margin: 10px 0;
            line-height: 1.4;
        `;

        elementoStatus.textContent = estaAtivo()
            ? "Continuando automação..."
            : "Aguardando início.";

        const iniciarBotao = document.createElement("button");
        iniciarBotao.textContent = "Aplicar todos";
        iniciarBotao.style.cssText = `
            padding: 9px 12px;
            margin-right: 8px;
            border: 0;
            border-radius: 6px;
            color: #fff;
            background: #3483fa;
            cursor: pointer;
        `;

        const pararBotao = document.createElement("button");
        pararBotao.textContent = "Parar";
        pararBotao.style.cssText = `
            padding: 9px 12px;
            border: 0;
            border-radius: 6px;
            color: #fff;
            background: #d93025;
            cursor: pointer;
        `;

        iniciarBotao.addEventListener("click", iniciar);
        pararBotao.addEventListener("click", parar);

        painel.appendChild(titulo);
        painel.appendChild(elementoStatus);
        painel.appendChild(iniciarBotao);
        painel.appendChild(pararBotao);

        document.body.appendChild(painel);
    };

    criarPainel();

    if (estaAtivo()) {
        definirStatus("Página carregada. Continuando...");
        setTimeout(processarPagina, 1000);
    }
})();
