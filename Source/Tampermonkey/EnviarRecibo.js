// ==UserScript==
// @name         Imprimir comprovante
// @namespace    http://tampermonkey.net/
// @version      4.7
// @description  Script that injects a new action on the menu to send mail with the receipt.
// @author       Fabricio Oliveira Silva - fauosilva@gmail.com
// @match        https://*.gestaoclick.com/financeiro/movimentacoes_financeiras/index_recebimento*
// @updateURL    https://raw.githubusercontent.com/fauosilva/CEFV-GestaoClickPublic/master/Source/Tampermonkey/EnviarRecibo.js
// @downloadURL  https://raw.githubusercontent.com/fauosilva/CEFV-GestaoClickPublic/master/Source/Tampermonkey/EnviarRecibo.js
// @run-at document-idle
// @grant    GM_addStyle
// ==/UserScript==

GM_addStyle(`
  .loader-violeta {
  border: 10px solid #f3f3f3;
  border-radius: 50%;
  border-top: 10px solid #993399;
  width: 30px;
  height: 30px;
  -webkit-animation: spinvioleta 2s linear infinite; /* Safari */
  animation: spinvioleta 2s linear infinite;
  display: inline-flex;
}

/* Safari */
@-webkit-keyframes spinvioleta {
  0% { -webkit-transform: rotate(0deg); }
  100% { -webkit-transform: rotate(360deg); }
}

@keyframes spinvioleta {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Rodapé no padrão dos modais nativos: Cancelar à esquerda, ações à direita */
#enviarEmail .rodape-formulario {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

#enviarEmail .acao-rodape span[title]:not([title=""]) {
  cursor: not-allowed;
}
` );

(function () {
    'use strict';

    const getSettings = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'ApiKey': 'fraternidade'
        }
    };

    const localeBr = new Intl.Locale("pt-BR");

    function htmlToElement(html) {
        let template = document.createElement('div');
        html = html.trim();
        template.innerHTML = html;
        return template;
    }

    function toggleLoader(show) {
        let loader = document.getElementsByClassName("loader-violeta")[0];
        if (show) {
            loader.classList.remove('d-none');
        } else {
            loader.classList.add('d-none');
        }
    }

    // tipo: 'success' | 'danger' | 'warning' | null (esconde)
    function setStatus(mensagem, tipo, link) {
        let status = document.getElementById('ReciboStatus');
        status.className = 'alert';
        if (!mensagem) {
            status.textContent = '';
            status.classList.add('d-none');
            return;
        }
        status.classList.add('alert-' + (tipo || 'success'));
        status.textContent = mensagem;
        if (link) {
            let anchor = document.createElement('a');
            anchor.href = link.href;
            anchor.target = '_blank';
            anchor.rel = 'noopener';
            anchor.className = 'alert-link ml-2';
            anchor.textContent = link.texto;
            status.appendChild(anchor);
        }
    }

    function temValor(valor) {
        return valor != null && String(valor).trim() !== '';
    }

    // A API devolve o valor no formato "160.00"; o recibo usa o texto como está, então formatamos em pt-BR
    function formatarValor(valor) {
        if (!temValor(valor)) return valor;
        let texto = String(valor).trim();
        if (!/^-?\d+(\.\d+)?$/.test(texto)) return texto;
        return Number(texto).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function togglePopup(show) {
        let popup = document.getElementById("enviarEmail");
        let backdrop = document.getElementById("enviarEmailBackdrop");
        if (show) {
            popup.classList.add('show');
            popup.style.display = 'block';
            document.body.classList.add('modal-open');
            if (!backdrop) {
                backdrop = document.createElement('div');
                backdrop.id = 'enviarEmailBackdrop';
                backdrop.className = 'modal-backdrop fade show';
                document.body.appendChild(backdrop);
            } else {
                backdrop.style.display = '';
            }
        } else {
            popup.classList.remove('show');
            popup.style.display = 'none';
            document.body.classList.remove('modal-open');
            if (backdrop) {
                backdrop.style.display = 'none';
            }
        }
    }


    function addMinutes(date, minutes) {
        return new Date(date.getTime() + minutes * 60000);
    }

    const getContatosCliente = async (link) => {
        let resultText = await fetch(link).then(ReadableStream => ReadableStream.text());

        let htmlResult = htmlToElement(resultText);
        let usefullProperties = ['Código', 'Nome', 'Celular', 'E-mail', 'Membro'];
        return tabularSearch(htmlResult, usefullProperties);
    }

    const getPropriedadesRecibo = async (linkDetalhes) => {
        limparPopup();
        let fetchResult = await fetch(linkDetalhes).then(ReadableStream => ReadableStream.text());
        let JSONResultado = await parsePropriedadesRecibo(fetchResult);
        let recibo = await getStatusRecibo(JSONResultado.DadosRecibo['Código']);
        JSONResultado.ReciboDetails = recibo;

        if (JSONResultado.ReciboDetails != null) {
            preencherDadosReciboEnviado(JSONResultado.ReciboDetails);
        } else {
            await preencherPopup(JSONResultado);
        }

        return JSONResultado;
    }

    const getPropriedadesReciboNew = async (codigo) => {

        limparPopup();
        togglePopup(true);

        let JSONResultado = {};
        let reciboStatus = await getStatusRecibo(codigo);
        JSONResultado.ReciboDetails = reciboStatus;

        let reciboInformacoes = await getDadosRecibo(codigo);
        if(reciboInformacoes != null){
            let dadosRecibo = {};
            dadosRecibo["Código"] = codigo;
            dadosRecibo["Plano de contas"] = reciboInformacoes.planoContas;
            dadosRecibo["Data de confirmação"] = reciboInformacoes.dataConfirmacao;
            dadosRecibo["Valor total"] = formatarValor(reciboInformacoes.valorTotal);
            dadosRecibo["Descrição do recebimento"] = reciboInformacoes.descricao;
            dadosRecibo["Observações"] = null;


            let dadosCliente = {};
            dadosCliente["Nome"] = reciboInformacoes.cliente.nomeCliente;
            dadosCliente["E-mail"] = reciboInformacoes.cliente.emailCliente;
            dadosCliente["Celular"] = reciboInformacoes.cliente.celularCliente;

            JSONResultado.DadosCliente = dadosCliente;
            JSONResultado.DadosRecibo = dadosRecibo;
            console.log(JSONResultado);
            window.DadosJson = JSONResultado;
        }


        if (JSONResultado.ReciboDetails != null) {
            preencherDadosReciboEnviado(JSONResultado.ReciboDetails);
        } else {
            await preencherPopup(JSONResultado);
        }

        return JSONResultado;
    }

    const getStatusRecibo = async (codigo) => {
        const apiUrl = `https://gestaointegration.azurewebsites.net/api/recibo/${codigo}`;

        toggleLoader(true);
        const status = await fetch(apiUrl, getSettings).then(function (response) {
            if (response.ok) {
                const currentStatus = response.json().then((data) => {
                    const dataRecibo = addMinutes(new Date(data.dataRecibo), 240).toLocaleDateString(localeBr);
                    data.ReciboStatus = `Recibo ${data.numeroRecibo}/${data.anoRecibo} enviado em ${dataRecibo}`
                    return data;
                });
                return currentStatus;
            } else {
                return null;
            }
        })
            .catch(function (error) {
                console.log('There has been a problem with your fetch operation: ' + error.message);
            })
            .finally(() => { toggleLoader(false) });

        return status;
    }

    const getDadosRecibo = async (codigo) => {
        const apiUrl = `https://gestaointegration.azurewebsites.net/api/informacoes/${codigo}`;

        toggleLoader(true);
        const status = await fetch(apiUrl, getSettings).then(function (response) {
            if (response.ok) {
                const currentStatus = response.json().then((data) => {
                    return data;
                });
                return currentStatus;
            } else {
                return null;
            }
        })
            .catch(function (error) {
                console.log('There has been a problem with your fetch operation: ' + error.message);
            })
            .finally(() => { toggleLoader(false) });

        return status;
    }


    function limparPopup() {
        document.getElementById('TipoRecibo').value = 0;
        document.getElementById('ReciboNumero').value = "";
        document.getElementById('ReciboAno').value = "";
        document.getElementById('ReciboNome').value = "";
        document.getElementById('ReciboPlano').value = "";
        document.getElementById('ReciboData').value = "";
        document.getElementById('ReciboValorTotal').value = "";
        document.getElementById('ReciboDescricao').value = "";
        document.getElementById('ReciboEmail').value = "";
        document.getElementById('ReciboTelefone').value = "";
        setStatus(null);

        bloquearBotoesEnvio(false);
        toggleBotoes(false, false);
    }

    function preencherDadosReciboEnviado(ReciboEnviado) {
        document.getElementById('TipoRecibo').value = ReciboEnviado.emailTemplate;
        document.getElementById('ReciboNumero').value = ReciboEnviado.numeroRecibo;
        document.getElementById('ReciboAno').value = ReciboEnviado.anoRecibo;
        document.getElementById('ReciboNome').value = ReciboEnviado.nome;
        document.getElementById('ReciboPlano').value = ReciboEnviado.planoDeContas;
        document.getElementById('ReciboData').value = addMinutes(new Date(ReciboEnviado.dataRecibo), 240).toLocaleDateString(localeBr);
        document.getElementById('ReciboValorTotal').value = ReciboEnviado.valor;
        document.getElementById('ReciboDescricao').value = ReciboEnviado.descricao;
        document.getElementById('ReciboEmail').value = ReciboEnviado.requestDetails.clienteRequest.email;
        document.getElementById('ReciboTelefone').value = ReciboEnviado.requestDetails.clienteRequest.celular;
        setStatus(ReciboEnviado.ReciboStatus, 'success');

        let temEmail = temValor(ReciboEnviado.requestDetails.clienteRequest.email);
        let temCelular = temValor(ReciboEnviado.requestDetails.clienteRequest.celular);
        toggleBotoes(temEmail, temCelular);
    }

    async function preencherPopup(JsonDados) {
        definirProximoNumeroRecibo();
        document.getElementById('ReciboNome').value = JsonDados.DadosCliente.Nome;
        document.getElementById('ReciboPlano').value = JsonDados.DadosRecibo["Plano de contas"];
        document.getElementById('ReciboData').value = JsonDados.DadosRecibo["Data de confirmação"];
        document.getElementById('ReciboValorTotal').value = JsonDados.DadosRecibo["Valor total"];
        document.getElementById('ReciboDescricao').value = JsonDados.DadosRecibo["Descrição do recebimento"];
        if (JsonDados.DadosRecibo["Observações"] != null) {
            document.getElementById('ReciboDescricao').value = document.getElementById('ReciboDescricao').value + " - " + JsonDados.DadosRecibo["Observações"];
        }
        document.getElementById('ReciboEmail').value = JsonDados.DadosCliente["E-mail"];
        document.getElementById('ReciboTelefone').value = JsonDados.DadosCliente.Celular;
        if (JsonDados.ReciboDetails != null && JsonDados.ReciboDetails.ReciboStatus != null) {
            setStatus(JsonDados.ReciboDetails.ReciboStatus, 'success');
        }

        let temEmail = temValor(JsonDados.DadosCliente["E-mail"]);
        let temCelular = temValor(JsonDados.DadosCliente.Celular);
        toggleBotoes(temEmail, temCelular);
    }

    const parsePropriedadesRecibo = async (responseText) => {
        let baseDocument = htmlToElement(responseText);
        let usefullProperties = ['Código', 'Descrição do recebimento', 'Plano de contas', 'Data do vencimento', 'Data de confirmação', 'Cliente', 'Observações', 'Valor total'];
        let dadosRecibo = tabularSearch(baseDocument, usefullProperties);
        let dadosCliente;
        let thCliente = document.evaluate("//*/th[text()='Cliente']", baseDocument, null, XPathResult.ANY_TYPE, null).iterateNext();
        if (thCliente) {
            let link = thCliente.closest('tr').querySelector('a').href;
            if (link) {
                dadosCliente = await getContatosCliente(link);
            }
        }

        let JSONproperties = {};
        JSONproperties.DadosCliente = dadosCliente;
        JSONproperties.DadosRecibo = dadosRecibo;
        console.log(JSONproperties);
        window.DadosJson = JSONproperties;
        return JSONproperties;

    }

    function tabularSearch(baseDocument, usefullProperties) {
        let returnJson = {};
        if (baseDocument === null) {
            baseDocument = document;
        }
        let allProperties = baseDocument.querySelectorAll('tr');
        for (let i = 0; i < allProperties.length; i++) {
            var headerPropriedade = allProperties[i].getElementsByTagName('th');
            if (headerPropriedade && headerPropriedade.length > 0) {
                var nomePropriedade = headerPropriedade[0].innerText;
            }
            if (usefullProperties.includes(nomePropriedade)) {
                var fieldPropriedade = allProperties[i].getElementsByTagName('td');
                if (fieldPropriedade && fieldPropriedade.length > 0) {
                    var valor = fieldPropriedade[0].innerText.trim();
                    if (valor) {
                        returnJson[nomePropriedade] = valor;
                    }
                }
            }
        }
        return returnJson;
    }

    function getTransactionDetailsLink(actionMenu) {
        let visualizarAction = actionMenu.querySelector('a[href*="visualizar_recebimento"]');
        return visualizarAction.href;
    }

    function criarPopUp() {
        // Estrutura espelhada dos modais nativos do GestãoClick (ex.: "Imprimir recibo").
        // Manter sincronizado com Templates/PopupTemplate.html
        let popup = htmlToElement(
            '<div class="modal fade" role="dialog" aria-modal="true" id="enviarEmail" tabindex="-1">' +
              '<div class="modal-dialog modal-lg">' +
                '<div class="modal-content modal-frame">' +
                  '<div class="modal-body">' +
                    '<button type="button" aria-label="Close" class="close" id="BotaoFechar">&times;</button>' +
                    '<section class="content-header" modal="true">' +
                      '<h4 class="mb-1 d-inline-block">Enviar recibo</h4>' +
                      '<div class="loader-violeta d-none" style="width: 16px; height: 16px; border-width: 4px; margin-left: 10px; vertical-align: middle;"></div>' +
                      '<hr>' +
                      '<section class="content">' +
                        '<form id="FormEnviarRecibo" onsubmit="return false;">' +
                          '<div id="ReciboStatus" class="alert d-none" role="status"></div>' +
                          '<div class="form-row">' +
                            '<div class="form-group required col-sm-4">' +
                              '<label for="TipoRecibo" class="d-block">Tipo do recibo</label>' +
                              '<select autocomplete="off" class="form-control" id="TipoRecibo" name="tiporecibo">' +
                                '<option value="0">Mensalidade</option>' +
                                '<option value="1">Doação</option>' +
                              '</select>' +
                            '</div>' +
                            '<div class="form-group required col-sm-4">' +
                              '<label for="ReciboNumero" class="d-block">Número do recibo</label>' +
                              '<input type="text" autocomplete="off" id="ReciboNumero" name="recibonumero" class="form-control" maxlength="10">' +
                            '</div>' +
                            '<div class="form-group required col-sm-4">' +
                              '<label for="ReciboAno" class="d-block">Ano do recibo</label>' +
                              '<input type="text" autocomplete="off" id="ReciboAno" name="reciboano" class="form-control" maxlength="4">' +
                            '</div>' +
                            '<div class="form-group required col-sm-6">' +
                              '<label for="ReciboNome" class="d-block">Nome do cliente</label>' +
                              '<input type="text" autocomplete="off" id="ReciboNome" name="nome" class="form-control" maxlength="100">' +
                            '</div>' +
                            '<div class="form-group required col-sm-6">' +
                              '<label for="ReciboPlano" class="d-block">Plano de contas</label>' +
                              '<input type="text" autocomplete="off" id="ReciboPlano" name="plano" class="form-control" readonly>' +
                            '</div>' +
                            '<div class="form-group required col-sm-6">' +
                              '<label for="ReciboData" class="d-block">Data do pagamento</label>' +
                              '<input type="text" autocomplete="off" id="ReciboData" name="data" class="form-control" maxlength="10">' +
                            '</div>' +
                            '<div class="form-group required col-sm-6">' +
                              '<label for="ReciboValorTotal" class="d-block">Valor</label>' +
                              '<input type="text" autocomplete="off" id="ReciboValorTotal" name="valor" class="form-control" style="text-align: right;">' +
                            '</div>' +
                            '<div class="form-group required col-sm-12">' +
                              '<label for="ReciboDescricao" class="d-block">Descrição</label>' +
                              '<textarea autocomplete="off" id="ReciboDescricao" name="descricao" class="form-control" rows="4" wrap="soft"></textarea>' +
                            '</div>' +
                            '<div class="form-group col-sm-6">' +
                              '<label for="ReciboEmail" class="d-block">E-mail</label>' +
                              '<input type="text" autocomplete="off" id="ReciboEmail" name="email" class="form-control" readonly>' +
                            '</div>' +
                            '<div class="form-group col-sm-6">' +
                              '<label for="ReciboTelefone" class="d-block">Celular</label>' +
                              '<input type="text" autocomplete="off" id="ReciboTelefone" name="telefone" class="form-control" readonly>' +
                            '</div>' +
                          '</div>' +
                          '<div class="rodape-formulario">' +
                            '<div class="cancelar-rodape">' +
                              '<button type="button" class="btn btn-default" id="BotaoCancelar">Cancelar</button>' +
                            '</div>' +
                            '<div class="acao-rodape">' +
                              '<span class="d-inline-block mr-2"><button type="button" class="btn btn-default" id="BotaoEnviaWhatsapp"><i class="fa fa-mobile mr-1"></i>Via WhatsApp</button></span>' +
                              '<span class="d-inline-block mr-2"><button type="button" class="btn btn-default" id="BotaoEnviaEmail"><i class="fa fa-envelope mr-1"></i>Via e-mail</button></span>' +
                              '<span class="d-inline-block"><button type="button" class="btn btn-primary" id="BotaoEnviaNotificacao">Enviar</button></span>' +
                            '</div>' +
                          '</div>' +
                        '</form>' +
                      '</section>' +
                    '</section>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>'
        );
        return popup;
    }

    function createEnviarRecebimento(link) {
        let listItem = document.createElement('li');
        listItem.style = "cursor: pointer;";
        let anchor = document.createElement('a');
        anchor.onclick = function () { getPropriedadesRecibo(link); };
        anchor.setAttribute("data-toggle", "modal");
        anchor.setAttribute("data-target", "#enviarEmail");
        let icon = document.createElement('i');
        icon.className = "text-maroon fa fa-envelope";
        anchor.appendChild(icon);
        anchor.appendChild(document.createTextNode('Enviar recibo'));
        listItem.appendChild(anchor);
        return listItem;
    }

    function createEnviarRecebimentoNew(codigo) {
        let listItem = document.createElement('li');
        listItem.setAttribute('role', 'presentation');
        let anchor = document.createElement('a');
        anchor.setAttribute('role', 'menuitem');
        anchor.className = 'dropdown-item';
        anchor.href = '#';
        anchor.onclick = function (e) {
            e.preventDefault();
            // Fecha o menu de ações (dropdown do Bootstrap-Vue) antes de abrir o popup
            let dropdown = anchor.closest('.dropdown');
            let dropdownVue = dropdown?.__vue__;
            if (dropdownVue && typeof dropdownVue.hide === 'function') {
                dropdownVue.hide();
            } else if (anchor.closest('.dropdown-menu')?.classList.contains('show')) {
                dropdown?.querySelector('.dropdown-toggle')?.click();
            }
            getPropriedadesReciboNew(codigo);
        };
        let icon = document.createElement('i');
        icon.className = "text-maroon fa fa-envelope mr-2";
        anchor.appendChild(icon);
        anchor.appendChild(document.createTextNode(' Enviar recibo'));
        listItem.appendChild(anchor);
        return listItem;
    }

    function inserirEnviarRecebimento(item, index) {
        let menuAcoes = item.closest('td');
        let linkDetalhesTransacao = getTransactionDetailsLink(menuAcoes);
        item.appendChild(createEnviarRecebimento(linkDetalhesTransacao));
    }

    function getIndiceColunaCodigo(table) {
        let headers = table.querySelectorAll('thead th');
        for (let i = 0; i < headers.length; i++) {
            let titulo = headers[i].innerText.trim().split('\n')[0].trim();
            if (titulo === 'Nº' || titulo === 'Código') {
                return i;
            }
        }
        return -1;
    }

    function getCodigoRecebimento(row) {
        let indice = getIndiceColunaCodigo(row.closest('table'));
        if (indice >= 0 && row.cells[indice]) {
            return row.cells[indice].innerText.trim();
        }
        // Fallback: primeira célula com conteúdo numérico (ignora coluna de seleção)
        for (let j = 0; j < row.cells.length; j++) {
            let texto = row.cells[j].innerText.trim();
            if (/^\d+$/.test(texto)) {
                return texto;
            }
        }
        return null;
    }

    function exibirAvisoColunaCodigo(table) {
        if (document.getElementById('AvisoColunaCodigo')) return;
        let aviso = document.createElement('div');
        aviso.id = 'AvisoColunaCodigo';
        aviso.className = 'alert alert-warning';
        aviso.setAttribute('role', 'alert');
        aviso.textContent = 'Enviar recibo: não foi possível identificar o código dos recebimentos. Habilite a coluna "Nº" na visualização da tabela.';
        table.parentElement.insertBefore(aviso, table);
    }

    function inserirEnviarRecebimentoNew(row, item, index) {
        let codigo = getCodigoRecebimento(row);
        if (isNaN(parseInt(codigo, 10))) {
            exibirAvisoColunaCodigo(row.closest('table'));
            return;
        }
        item.appendChild(createEnviarRecebimentoNew(codigo));
    }


    const getProximoNumeroRecibo = async () => {
        const proximoNumeroRecibo = await fetch('https://gestaointegration.azurewebsites.net/api/recibo/proximo', getSettings)
            .then((response) => {
                const proximoRecibo = response.json().then((data) => {
                    return {
                        NumeroRecibo: data.numeroRecibo,
                        Ano: data.anoRecibo
                    };
                });
                return proximoRecibo;
            });
        return proximoNumeroRecibo;
    }

    const getProximoNumeroReciboByTemplate = async (template) => {
        toggleLoader(true);
        const proximoNumeroRecibo = await fetch('https://gestaointegration.azurewebsites.net/api/recibo/codigo/' + template, getSettings)
            .then((response) => {
                const proximoRecibo = response.json().then((data) => {
                    return {
                        NumeroRecibo: data.numeroRecibo,
                        Ano: data.anoRecibo
                    };
                });
                return proximoRecibo;
            })
            .finally(() => { toggleLoader(false) });
        return proximoNumeroRecibo;
    }


    let envioEmAndamento = false;
    let envioBloqueado = false;
    let contatosCliente = { email: false, celular: false };

    function bloquearBotoesEnvio(bloquear) {
        envioBloqueado = bloquear;
        document.getElementById('TipoRecibo').disabled = bloquear;
        atualizarBotoesEnvio();
    }

    // Converte o celular do cadastro para o formato do wa.me (somente dígitos, com DDI 55)
    function normalizarCelular(celular) {
        let digitos = String(celular || '').replace(/\D/g, '').replace(/^0+/, '');
        if (digitos.length === 10 || digitos.length === 11) {
            digitos = '55' + digitos;
        }
        return /^55\d{10,11}$/.test(digitos) ? digitos : null;
    }

    function montarMensagemWhatsapp(recibo) {
        let tipo = parseInt(document.getElementById('TipoRecibo').value, 10) === 1 ? 'doação' : 'contribuição';
        let primeiroNome = recibo.nome.trim().split(/\s+/)[0];
        // Sem emojis: o redirecionamento do wa.me/api.whatsapp.com corrompe caracteres fora do BMP (vira "�")
        return `Olá, ${primeiroNome}!\n\n` +
            `Agradecemos a sua ${tipo} ao Centro Espiritualista Fonte Violeta.\n\n` +
            `*Recibo nº ${recibo.numero}/${recibo.ano}*\n` +
            `Referente a: ${recibo.descricao}\n` +
            `Valor: R$ ${recibo.valor}\n` +
            `Data do pagamento: ${recibo.data}\n\n` +
            (recibo.link ? `Visualize o recibo: ${recibo.link}\n\n` : '') +
            `Tesouraria CEFV`;
    }

    const enviaNotificacao = async (enviaEmail, enviaWhatsapp) => {
        if (envioEmAndamento) return;

        enviaEmail = enviaEmail && contatosCliente.email;
        enviaWhatsapp = enviaWhatsapp && contatosCliente.celular;
        if (!enviaEmail && !enviaWhatsapp) return;

        let celularWhatsapp = null;
        let janelaWhatsapp = null;
        if (enviaWhatsapp) {
            celularWhatsapp = normalizarCelular(document.getElementById('ReciboTelefone').value);
            if (!celularWhatsapp) {
                setStatus('Celular do cliente em formato inválido para o WhatsApp: ' + document.getElementById('ReciboTelefone').value, 'danger');
                return;
            }
            // Abre a aba ainda no clique para não ser bloqueada como pop-up; o endereço é definido após a resposta da API
            janelaWhatsapp = window.open('', '_blank');
        }

        envioEmAndamento = true;
        bloquearBotoesEnvio(true);
        setStatus(null);

        const objetoRequest = {};

        toggleLoader(true);
        objetoRequest.DadosNotificacaoRecibo = {
            EmailTemplate: parseInt(document.getElementById('TipoRecibo').value, 10),
            Numero: parseInt(document.getElementById('ReciboNumero').value, 10),
            Ano: parseInt(document.getElementById('ReciboAno').value, 10),
            PlanoDeContas: document.getElementById('ReciboPlano').value,
            Valor: document.getElementById('ReciboValorTotal').value,
            Data: document.getElementById('ReciboData').value,
            Descricao: document.getElementById('ReciboDescricao').value,
            Nome: document.getElementById('ReciboNome').value,
            Email: enviaEmail,
            WhatsApp: enviaWhatsapp
        }

        objetoRequest.DadosCliente = window.DadosJson.DadosCliente;
        objetoRequest.DadosRecibo = window.DadosJson.DadosRecibo;

        const rawResponse = await fetch('https://gestaointegration.azurewebsites.net/api/recibo', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'ApiKey': 'fraternidade'
            },
            body: JSON.stringify(objetoRequest)
        }).then(async (response) => {

            if (response.ok) {
                // O backend devolve o recibo gravado; se já existia, o número dele prevalece sobre o do formulário
                let reciboGravado = await response.json().catch(() => null);
                let recibo = {
                    numero: reciboGravado?.numeroRecibo ?? objetoRequest.DadosNotificacaoRecibo.Numero,
                    ano: reciboGravado?.anoRecibo ?? objetoRequest.DadosNotificacaoRecibo.Ano,
                    nome: objetoRequest.DadosNotificacaoRecibo.Nome,
                    descricao: objetoRequest.DadosNotificacaoRecibo.Descricao,
                    valor: objetoRequest.DadosNotificacaoRecibo.Valor,
                    data: objetoRequest.DadosNotificacaoRecibo.Data,
                    link: reciboGravado?.linkVisualizacao
                };

                let canais = [];
                if (enviaEmail) canais.push('e-mail');
                let linkWhatsapp = null;
                if (enviaWhatsapp) {
                    linkWhatsapp = `https://wa.me/${celularWhatsapp}?text=${encodeURIComponent(montarMensagemWhatsapp(recibo))}`;
                    if (janelaWhatsapp && !janelaWhatsapp.closed) {
                        janelaWhatsapp.location.href = linkWhatsapp;
                    }
                    canais.push('WhatsApp (confirme o envio na aba aberta)');
                }

                setStatus(`Recibo ${recibo.numero}/${recibo.ano} enviado via ${canais.join(' e ')}.`, 'success',
                    linkWhatsapp ? { href: linkWhatsapp, texto: 'Abrir WhatsApp novamente' } : null);
                // Mantém os botões bloqueados para evitar reenvio do mesmo recibo
                return;
            }
            janelaWhatsapp?.close();
            let detalhe = await response.text().catch(() => '');
            setStatus('Erro ao enviar recibo. ' + detalhe, 'danger');
            bloquearBotoesEnvio(false);
        }).catch((error) => {
            janelaWhatsapp?.close();
            setStatus('Erro ao enviar recibo. ' + error.message, 'danger');
            bloquearBotoesEnvio(false);
        }).finally(() => {
            envioEmAndamento = false;
            atualizarBotoesEnvio();
            toggleLoader(false);
        });
    }

    let ultimaBuscaNumeroRecibo = 0;

    async function definirProximoNumeroRecibo() {
        let tipoRecibo = document.getElementById('TipoRecibo');
        const buscaAtual = ++ultimaBuscaNumeroRecibo;
        const proximoNumeroRecibo = await getProximoNumeroReciboByTemplate(tipoRecibo.value);
        // Ignora respostas de buscas anteriores (troca rápida de tipo)
        if (buscaAtual !== ultimaBuscaNumeroRecibo) return;
        document.getElementById('ReciboNumero').value = proximoNumeroRecibo.NumeroRecibo;
        document.getElementById('ReciboAno').value = proximoNumeroRecibo.Ano;
    }

    function definirAcoesBotao() {
        let enviaNotificacaoButton = document.getElementById('BotaoEnviaNotificacao');
        enviaNotificacaoButton.onclick = function () { enviaNotificacao(true, true); };
        let enviaEmailButton = document.getElementById('BotaoEnviaEmail');
        enviaEmailButton.onclick = function () { enviaNotificacao(true, false); };
        let enviaWhatsappButton = document.getElementById('BotaoEnviaWhatsapp');
        enviaWhatsappButton.onclick = function () { enviaNotificacao(false, true); };

        let botaoFechar = document.getElementById("BotaoFechar");
        botaoFechar.onclick = function () { togglePopup(false) };
        let botaoCancelar = document.getElementById("BotaoCancelar");
        botaoCancelar.onclick = function() { togglePopup(false) };

        let tipoRecibo = document.getElementById('TipoRecibo');
        tipoRecibo.onchange = function () { definirProximoNumeroRecibo(); };
    }

    function toggleBotoes(temEmail, temCelular) {
        contatosCliente.email = temEmail;
        contatosCliente.celular = temCelular;
        atualizarBotoesEnvio();
    }

    // Botão fica sempre visível; quando indisponível é desabilitado e o motivo aparece no tooltip (title do wrapper,
    // pois botões desabilitados não recebem eventos de mouse)
    function definirEstadoBotao(id, habilitado, motivo) {
        let botao = document.getElementById(id);
        botao.disabled = !habilitado;
        botao.style.pointerEvents = habilitado ? '' : 'none';
        botao.parentElement.title = habilitado ? '' : motivo;
    }

    function atualizarBotoesEnvio() {
        const semEmail = 'Cliente sem e-mail cadastrado no GestãoClick.';
        const semCelular = 'Cliente sem celular cadastrado no GestãoClick.';
        const motivoBloqueio = !envioBloqueado ? null : (envioEmAndamento ? 'Enviando recibo...' : 'Recibo já enviado.');

        definirEstadoBotao('BotaoEnviaEmail', !envioBloqueado && contatosCliente.email, motivoBloqueio || semEmail);
        definirEstadoBotao('BotaoEnviaWhatsapp', !envioBloqueado && contatosCliente.celular, motivoBloqueio || semCelular);
        definirEstadoBotao('BotaoEnviaNotificacao', !envioBloqueado && (contatosCliente.email || contatosCliente.celular),
            motivoBloqueio || 'Cliente sem e-mail e celular cadastrados no GestãoClick.');
    }

    function injectMenuItems(table) {
        let menuSuspenso = table.getElementsByClassName("dropdown-menu");
        for (let i = 0; i < menuSuspenso.length; i++) {
            if (menuSuspenso[i].hasAttribute('data-recibo-injected')) continue;

            let row = menuSuspenso[i].closest('tr');
            let shouldInject = false;

            if (row.querySelector('.text-success') || row.querySelector('.label-success') || row.querySelector('.badge-success')) {
                shouldInject = true;
            }

            if (!shouldInject) {
                let cells = row.cells;
                for (let j = 0; j < cells.length; j++) {
                    if (cells[j].innerText.trim() === 'Confirmado') {
                        shouldInject = true;
                        break;
                    }
                }
            }

            if (shouldInject) {
                inserirEnviarRecebimentoNew(row, menuSuspenso[i], i);
                menuSuspenso[i].setAttribute('data-recibo-injected', 'true');
            }
        }
    }

    function getRecebimentosTable() {
        let popupCreated = false;

        setInterval(() => {
            const table = document.querySelector('table');
            if (!table) return;

            if (!popupCreated) {
                console.log("Encontrada tabela principal");
                let popup = criarPopUp();
                document.body.append(popup);
                definirAcoesBotao();
                popupCreated = true;
            }

            injectMenuItems(table);
        }, 1000);
    }

    getRecebimentosTable();
})();
