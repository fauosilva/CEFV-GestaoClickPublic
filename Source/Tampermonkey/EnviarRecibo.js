// ==UserScript==
// @name         Imprimir comprovante
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Script that injects a new action on the menu to send mail with the receipt.
// @author       Fabricio Oliveira Silva - fauosilva@gmail.com
// @match        https://gestaoclick.com/movimentacoes_financeiras/index_recebimento*
// @updateURL    https://raw.githubusercontent.com/fauosilva/CEFV-GestaoClickPublic/master/Source/Tampermonkey/EnviarRecibo.js
// @downloadURL  https://raw.githubusercontent.com/fauosilva/CEFV-GestaoClickPublic/master/Source/Tampermonkey/EnviarRecibo.js
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

    function htmlToElement(html) {
        var template = document.createElement('div');
        html = html.trim(); // Never return a text node of whitespace as the result
        template.innerHTML = html;
        return template;
    }

    function toggleLoader(show) {
        var loader = document.getElementsByClassName("loader-violeta")[0];
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
        let status = await getStatusRecibo(JSONResultado.DadosRecibo['Código']);
        JSONResultado.ReciboStatus = status;

        preencherPopup(JSONResultado);
        return JSONResultado;
    }

    const getStatusRecibo = async (codigo) => {
        const apiUrl = `https://gestaointegration.azurewebsites.net/api/recibo/${codigo}`;

        toggleLoader(true);
        const status = await fetch(apiUrl).then(function (response) {
            if (response.ok) {
                const currentStatus = response.json().then((data) => {
                    const dataRecibo = addMinutes(new Date(data.dataRecibo),240).toLocaleDateString();
                    return `Recibo ${data.numeroRecibo}/${data.anoRecibo} enviado em ${dataRecibo}`;
                });
                return currentStatus;
            } else {
                return '';
            }
        })
            .catch(function (error) {
                console.log('There has been a problem with your fetch operation: ' + error.message);
            })
            .finally(() => { toggleLoader(false) });

        return status;
    }

    function limparPopup() {
        document.getElementById('ReciboNome').value = "";
        document.getElementById('ReciboPlano').value = "";
        document.getElementById('ReciboData').value = "";
        document.getElementById('ReciboValorTotal').value = "";
        document.getElementById('ReciboDescricao').value = "";
        document.getElementById('ReciboEmail').value = "";
        document.getElementById('ReciboTelefone').value = "";
        document.getElementById('ReciboStatus').innerHTML = "";
    }

    function preencherPopup(JsonDados) {
        document.getElementById('ReciboNome').value = JsonDados.DadosCliente.Nome;
        document.getElementById('ReciboPlano').value = JsonDados.DadosRecibo["Plano de contas"];
        document.getElementById('ReciboData').value = JsonDados.DadosRecibo["Data de confirmação"];
        document.getElementById('ReciboValorTotal').value = JsonDados.DadosRecibo["Valor total"];
        document.getElementById('ReciboDescricao').value = JsonDados.DadosRecibo["Descrição do recebimento"] + " - " + JsonDados.DadosRecibo["Observações"];
        document.getElementById('ReciboEmail').value = JsonDados.DadosCliente["E-mail"];
        document.getElementById('ReciboTelefone').value = JsonDados.DadosCliente.Celular;
        document.getElementById('ReciboStatus').innerHTML = JsonDados.ReciboStatus;
    }

    const parsePropriedadesRecibo = async (responseText) => {
        let baseDocument = htmlToElement(responseText);
        let usefullProperties = ['Código', 'Descrição do recebimento', 'Plano de contas', 'Data do vencimento', 'Data de confirmação', 'Cliente', 'Observações', 'Valor total'];
        let dadosRecibo = tabularSearch(baseDocument, usefullProperties);
        let dadosCliente;
        var thCliente = document.evaluate("//*/th[text()='Cliente']", baseDocument, null, XPathResult.ANY_TYPE, null).iterateNext();
        if (thCliente) {
            var link = thCliente.closest('tr').querySelector('a').href;
            if (link) {
                dadosCliente = await getContatosCliente(link);
            }
        }

        let JSON = {};
        JSON.DadosCliente = dadosCliente;
        JSON.DadosRecibo = dadosRecibo;
        console.log(JSON);
        window.DadosJson = JSON;
        return JSON;

    }

    function tabularSearch(baseDocument, usefullProperties) {
        let returnJson = {};
        if (baseDocument === null) {
            baseDocument = document;
        }
        var allProperties = baseDocument.querySelectorAll('tr');
        for (var i = 0; i < allProperties.length; i++) {
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
        var visualizarAction = actionMenu.querySelector('a[href*="visualizar_recebimento"]');
        return visualizarAction.href;
    }

    function criarPopUp() {
        let popup = htmlToElement('<div class="bootbox modal fade in" tabindex="-1" role="dialog" aria-hidden="false" id="enviarEmail"> <div class="modal-dialog modal-lg"> <div class="modal-content"> <div class="modal-header"> <button type="button" class="bootbox-close-button close" data-dismiss="modal" aria-hidden="true">×</button> <h3 class="modal-title" style="display:inline;" id="titulo">Enviar Recibo</h3> <div class="loader-violeta" style="display:inline-flex; margin-top:5px; margin-left:5px;"></div><h6 style="color: green;" id="ReciboStatus"></h6> </div><div class="modal-body"> <div class="bootbox-body"> <section class="content" style="margin-bottom: 10px; padding-bottom: 10px;"> <div class="box"> <div class="row"> <div class="col-sm-12 col-lg-12 col-md-12"> <div style="display:none;" wfd-invisible="true"> <input type="hidden" name="_method" value="PUT"> </div><input type="hidden" name="imprimir" value="1" autocomplete="off" id="MovimentacoesFinanceiraImprimir" wfd-invisible="true"> <div class="required form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboNome">Nome do Cliente</label> <input name="nome" maxlength="100" value="" required="required" class="required form-control" autocomplete="off" type="text" id="ReciboNome" placeholder=""> </div><div class="required form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboPlano">Plano de Contas</label> <input name="plano" maxlength="30" value="" required="required" class="required form-control" autocomplete="off" type="text" id="ReciboPlano" placeholder="" readonly> </div><div class="required form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboData">Data do pagamento</label> <input name="data" maxlength="10" value="" required="required" class="required datepicker mascara-data form-control" autocomplete="off" type="text" id="ReciboData" placeholder=""> </div><div class="required form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboValorTotal">Valor</label> <input name="valor" required="required" class="mascara-valor required form-control" autocomplete="off" type="text" value="" id="ReciboValorTotal" placeholder=""> </div><div class="col-sm-12 col-lg-12 col-md-12 required"> <label for="ReciboDescricao">Descrição</label> <textarea name="descricao" class="form-control" autocomplete="off" cols="30" rows="6" id="ReciboDescricao" required="required"></textarea> </div><div class="col-sm-12 col-lg-12 col-md-12"> <hr> </div><div class="form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboEmail">E-mail</label> <input name="plano" maxlength="30" value="" class="form-control" autocomplete="off" type="text" id="ReciboEmail" placeholder="" readonly> </div><div class="form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboTelefone">Número Telefone</label> <input name="telefone" maxlength="30" value="" class="form-control" autocomplete="off" type="text" id="ReciboTelefone" placeholder="" readonly> </div><div class="form-group col-sm-6 col-lg-6 col-md-6 margin-top-10px"> <button class="btn btn-primary" id="BotaoEnviaNotificacao"> <span class="glyphicon glyphicon-envelope margin-right-10px"></span>Enviar notificação </button> <a href="javascript:parent.bootbox.hideAll();" class="btn btn-danger"> <span class="glyphicon glyphicon-remove margin-right-10px"></span>Cancelar </a> </div><div class="form-group col-sm-6 col-lg-6 col-md-6 margin-top-10px"> <button class="btn btn-secondary float-right margin-right-10px" id="BotaoEnviaEmail"> <span class="glyphicon glyphicon-envelope margin-right-10px"></span>Enviar via e-mail </button> <button class="btn btn-secondary float-right margin-right-10px" id="BotaoEnviaWhatsapp"> <span class="glyphicon glyphicon-envelope margin-right-10px"></span>Enviar via whatsapp </button> </div></div></div></div></section> </div></div></div></div></div>');
        return popup;
    }

    function createEnviarRecebimento(link) {
        var listItem = document.createElement('li');
        var anchor = document.createElement('a');
        anchor.onclick = function () { getPropriedadesRecibo(link); };
        anchor.setAttribute("data-toggle", "modal");
        anchor.setAttribute("data-target", "#enviarEmail");
        var icon = document.createElement('i');
        icon.className = "text-maroon fa fa-envelope";
        anchor.appendChild(icon);
        anchor.appendChild(document.createTextNode('Enviar recibo'));
        listItem.appendChild(anchor);
        return listItem;
    }

    function inserirEnviarRecebimento(item, index) {
        var menuAcoes = item.closest('td');
        var linkDetalhesTransacao = getTransactionDetailsLink(menuAcoes);
        item.appendChild(createEnviarRecebimento(linkDetalhesTransacao));
    }

    const getProximoNumeroRecibo = async () => {
        const proximoNumeroRecibo = await fetch('https://gestaointegration.azurewebsites.net/api/recibo/proximo').then((response) => {
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


    const enviaNotificacao = async (enviaEmail, enviaWhatsapp) => {
        const objetoRequest = {};

        toggleLoader(true);
        const proximoNumeroRecibo = await getProximoNumeroRecibo();
        objetoRequest.DadosNotificacaoRecibo = {
            Numero: proximoNumeroRecibo.NumeroRecibo,
            Ano: proximoNumeroRecibo.Ano,
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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(objetoRequest)
        }).then((response) => {

            if (response.ok) {
                document.getElementById('ReciboStatus').innerHTML = `Recibo ${objetoRequest.DadosNotificacaoRecibo.Numero}/${objetoRequest.DadosNotificacaoRecibo.Ano} enviado em ${objetoRequest.DadosNotificacaoRecibo.Data}`;
            }
            else {
                document.getElementById('ReciboStatus').innerHTML = 'Erro ao enviar recibo';
            }
        }).finally(() => { toggleLoader(false) });
    }

    function definirAcoesBotao() {
        var enviaNotificacaoButton = document.getElementById('BotaoEnviaNotificacao');
        enviaNotificacaoButton.onclick = function () { enviaNotificacao(true, true); };
        var enviaEmailButton = document.getElementById('BotaoEnviaEmail');
        enviaEmailButton.onclick = function () { enviaNotificacao(true, false); };
        var enviaWhatsappButton = document.getElementById('BotaoEnviaWhatsapp');
        enviaWhatsappButton.onclick = function () { enviaNotificacao(false, true); };
    }

    var tabelaRecebimentos = document.getElementById("recebimentos");
    var menuSuspenso = tabelaRecebimentos.getElementsByClassName("dropdown-menu");
    var popup = criarPopUp();
    document.body.append(popup);

    definirAcoesBotao();

    for (var i = 0; i < menuSuspenso.length; i++) {
        //Verifica se o pagamento está na situação confirmado pelo seletor de classe de sucesso
        if (menuSuspenso[i].closest('tr').querySelector('.label-success')) {
            inserirEnviarRecebimento(menuSuspenso[i], i);
        }
    }
})();
