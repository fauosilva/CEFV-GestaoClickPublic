// ==UserScript==
// @name         Imprimir comprovante
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Script that injects a new action on the menu to send mail with the receipt.
// @author       Fabricio Oliveira Silva - fauosilva@gmail.com
// @match        https://*.gestaoclick.com/movimentacoes_financeiras/index_recebimento*
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
        html = html.trim(); // Never return a text node of whitespace as the result
        template.innerHTML = html;
        return template;
    }

    function toggleLoader(show) {
        let loader = document.getElementsByClassName("loader-violeta")[0];
        if (show) {
            loader.classList.remove('hidden');
        } else {
            loader.classList.add('hidden');
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
        document.getElementById('ReciboStatus').innerHTML = "";
        
        toggleBotoes(true, true);
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
        document.getElementById('ReciboStatus').innerHTML = ReciboEnviado.ReciboStatus;

        toggleBotoes(ReciboEnviado.requestDetails.clienteRequest.email != null, ReciboEnviado.requestDetails.clienteRequest.celular != null);
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
            document.getElementById('ReciboStatus').innerHTML = JsonDados.ReciboDetails.ReciboStatus;
        }

        definirAcoesDropdownTipoRecibo();
        toggleBotoes(JsonDados.DadosCliente["E-mail"] != null, JsonDados.DadosCliente.Celular != null);
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
                //console.log(nomePropriedade + " Extraído do HTML");
            }
            if (usefullProperties.includes(nomePropriedade)) {
                //console.log(nomePropriedade + " Encontrada dentro do array de proprieades a serem buscadas");
                var fieldPropriedade = allProperties[i].getElementsByTagName('td');
                if (fieldPropriedade && fieldPropriedade.length > 0) {
                    var valor = fieldPropriedade[0].innerText.trim();
                    //console.log(valor + " Extraído do HTML para a propriedade: " + nomePropriedade);
                    if (valor) {
                        returnJson[nomePropriedade] = valor;
                    }
                }
            }
        }
        //console.log(returnJson);
        return returnJson;
    }

    function getTransactionDetailsLink(actionMenu) {
        let visualizarAction = actionMenu.querySelector('a[href*="visualizar_recebimento"]');
        return visualizarAction.href;
    }

    function criarPopUp() {
        let popup = htmlToElement('<div class="bootbox modal fade in" tabindex="-1" role="dialog" aria-hidden="false" id="enviarEmail"><div class="modal-dialog modal-lg"><div class="modal-content"><div class="modal-header"><button type="button" class="bootbox-close-button close" data-dismiss="modal" aria-hidden="true">×</button><h3 class="modal-title" style="display:inline" id="titulo">Enviar Recibo</h3><div class="loader-violeta" style="display:inline-flex;margin-top:5px;margin-left:5px"></div><h6 style="color:green" id="ReciboStatus"></h6></div><div class="modal-body"><div class="bootbox-body"><section class="content" style="margin-bottom:10px;padding-bottom:10px"><div class="box"><div class="row"><div class="col-sm-12 col-lg-12 col-md-12"><div style="display:none" wfd-invisible="true"><input type="hidden" name="_method" value="PUT"></div><input type="hidden" name="imprimir" value="1" autocomplete="off" id="MovimentacoesFinanceiraImprimir" wfd-invisible="true"><div class="required form-group col-sm-12 col-lg-12 col-md-12"><label for="TipoRecibo">Tipo Recibo</label><select name="tiporecibo" class="form-control" autocomplete="off" id="TipoRecibo" required="required"><option value="0">Mensalidade</option><option value="1">Doação</option></select></div><div class="required form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboNumero">Numero do recibo</label><input name="recibonumero" maxlength="100" value="" required="required" class="required form-control" autocomplete="off" type="text" id="ReciboNumero" placeholder=""></div><div class="required form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboAno">Ano do recibo</label><input name="reciboano" maxlength="100" value="" required="required" class="required form-control" autocomplete="off" type="text" id="ReciboAno" placeholder=""></div><div class="required form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboNome">Nome do Cliente</label><input name="nome" maxlength="100" value="" required="required" class="required form-control" autocomplete="off" type="text" id="ReciboNome" placeholder=""></div><div class="required form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboPlano">Plano de Contas</label><input name="plano" maxlength="30" value="" required="required" class="required form-control" autocomplete="off" type="text" id="ReciboPlano" placeholder="" readonly="readonly"></div><div class="required form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboData">Data do pagamento</label><input name="data" maxlength="10" value="" required="required" class="required mascara-data form-control" autocomplete="off" type="text" id="ReciboData" placeholder=""></div><div class="required form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboValorTotal">Valor</label><input name="valor" required="required" class="mascara-valor required form-control" autocomplete="off" type="text" value="" id="ReciboValorTotal" placeholder=""></div><div class="col-sm-12 col-lg-12 col-md-12 required"><label for="ReciboDescricao">Descrição</label><textarea name="descricao" class="form-control" autocomplete="off" cols="30" rows="6" id="ReciboDescricao" required="required"></textarea></div><div class="col-sm-12 col-lg-12 col-md-12"><hr></div><div class="form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboEmail">E-mail</label><input name="plano" maxlength="30" value="" class="form-control" autocomplete="off" type="text" id="ReciboEmail" placeholder="" readonly="readonly"></div><div class="form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboTelefone">Número Telefone</label><input name="telefone" maxlength="30" value="" class="form-control" autocomplete="off" type="text" id="ReciboTelefone" placeholder="" readonly="readonly"></div><div class="form-group col-sm-6 col-lg-6 col-md-6 margin-top-10px"><button class="btn btn-primary" id="BotaoEnviaNotificacao"><span class="glyphicon glyphicon-envelope margin-right-10px"></span>Enviar notificação</button><a href="javascript:parent.bootbox.hideAll();" class="btn btn-danger"><span class="glyphicon glyphicon-remove margin-right-10px"></span>Cancelar</a></div><div class="form-group col-sm-6 col-lg-6 col-md-6 margin-top-10px"><button class="btn btn-secondary float-right margin-right-10px" id="BotaoEnviaEmail"><span class="glyphicon glyphicon-envelope margin-right-10px"></span>Enviar via e-mail</button><button class="btn btn-secondary float-right margin-right-10px" id="BotaoEnviaWhatsapp"><span class="glyphicon glyphicon-envelope margin-right-10px"></span>Enviar via whatsapp</button></div></div></div></div></section></div></div></div></div></div>');
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

    function inserirEnviarRecebimento(item, index) {
        let menuAcoes = item.closest('td');
        let linkDetalhesTransacao = getTransactionDetailsLink(menuAcoes);
        item.appendChild(createEnviarRecebimento(linkDetalhesTransacao));
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


    const enviaNotificacao = async (enviaEmail, enviaWhatsapp) => {
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

        //console.log(objetoRequest);

        const rawResponse = await fetch('https://gestaointegration.azurewebsites.net/api/recibo', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'ApiKey': 'fraternidade'
            },
            body: JSON.stringify(objetoRequest)
        }).then((response) => {

            if (response.ok) {
                document.getElementById('ReciboStatus').innerHTML = `Recibo ${objetoRequest.DadosNotificacaoRecibo.Numero}/${objetoRequest.DadosNotificacaoRecibo.Ano} enviado em ${objetoRequest.DadosNotificacaoRecibo.Data}`;
            }
            else {
                document.getElementById('ReciboStatus').innerHTML = 'Erro ao enviar recibo.';
            }
        }).finally(() => { toggleLoader(false) });
    }

    async function definirProximoNumeroRecibo() {
        let tipoRecibo = document.getElementById('TipoRecibo');
        const proximoNumeroRecibo = await getProximoNumeroReciboByTemplate(tipoRecibo.value);
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
    }

    function definirAcoesDropdownTipoRecibo() {
        let tipoRecibo = document.getElementById('TipoRecibo');
        tipoRecibo.addEventListener("change", (event) => {
            definirProximoNumeroRecibo()
        });
    }

    function toggleBotoes(enviaEmailEnabled, enviaWhatsappEnabled) {
        let enviaNotificacaoEnabled = true;
        if (enviaEmailEnabled == false && enviaWhatsappEnabled == false) {
            enviaNotificacaoEnabled = false;
        }

        let enviaNotificacaoButton = document.getElementById('BotaoEnviaNotificacao');
        if (!enviaNotificacaoEnabled) {
            enviaNotificacaoButton.style.display = "none";
        }
        else {
            enviaNotificacaoButton.style.display = "initial";
        }
        let enviaEmailButton = document.getElementById('BotaoEnviaEmail');
        if (!enviaEmailEnabled) {
            enviaEmailButton.style.display = "none";
        }
        else {
            enviaEmailButton.style.display = "initial";
        }
        let enviaWhatsappButton = document.getElementById('BotaoEnviaWhatsapp');
        if (!enviaWhatsappEnabled) {
            enviaWhatsappButton.style.display = "none";
        }
        else {
            enviaWhatsappButton.style.display = "initial";
        }
    }

    function getRecebimentosTable() {
        let retries = 50;

        const intervalID = setInterval(_ => {
            const tabelaRecebimentos = document.getElementsByTagName("table");
            if (tabelaRecebimentos != null && tabelaRecebimentos.length > 0) {
                console.log("Encontrada tabela principal");
                let menuSuspenso = tabelaRecebimentos[0].getElementsByClassName("dropdown-menu");
                let popup = criarPopUp();
                document.body.append(popup);

                definirAcoesBotao();

                for (let i = 0; i < menuSuspenso.length; i++) {
                    //Verifica se o pagamento está na situação confirmado pelo seletor de classe de sucesso
                    if (menuSuspenso[i].closest('tr').querySelector('.label-success') || menuSuspenso[i].closest('tr').querySelector('.badge-success')) {
                        inserirEnviarRecebimento(menuSuspenso[i], i);
                    }
                }
            }
            retries--;
            if (retries == 0 || (tabelaRecebimentos != null && tabelaRecebimentos.length > 0)) clearInterval(intervalID);
        }, 100);
    }

    //var tabelaRecebimentos = document.getElementById("recebimentos");
    //var tabelaRecebimentos = document.getElementsByTagName("table");
    getRecebimentosTable();
})();
