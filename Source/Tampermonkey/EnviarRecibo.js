// ==UserScript==
// @name         Imprimir comprovante
// @namespace    http://tampermonkey.net/
// @version      0.92
// @description  Script that injects a new action on the menu to send mail with the receipt.
// @author       Fabricio Oliveira Silva - fauosilva@gmail.com
// @match        https://gestaoclick.com/movimentacoes_financeiras/index_recebimento*
// @updateURL    https://raw.githubusercontent.com/fauosilva/CEFV-GestaoClickPublic/master/Source/Tampermonkey/EnviarRecibo.js
// @downloadURL  https://raw.githubusercontent.com/fauosilva/CEFV-GestaoClickPublic/master/Source/Tampermonkey/EnviarRecibo.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    function htmlToElement(html) {
        var template = document.createElement('div');
        html = html.trim(); // Never return a text node of whitespace as the result
        template.innerHTML = html;
        return template;
    }

    const getContatosCliente = async (link) => {
        let resultText = await fetch(link).then(ReadableStream => ReadableStream.text());

        let htmlResult = htmlToElement(resultText);
        let usefullProperties = ['Código', 'Nome', 'Celular', 'E-mail', 'Membro'];
        return tabularSearch(htmlResult, usefullProperties);
    }

    const getPropriedadesRecibo = async (linkDetalhes) => {
        let fetchResult = await fetch(linkDetalhes).then(ReadableStream => ReadableStream.text());
        let JSONResultado = await parsePropriedadesRecibo(fetchResult);
        let status = await getStatusRecibo(JSONResultado.DadosRecibo['Código']);
        JSONResultado.ReciboStatus = status;
        return JSONResultado;
    }

    const getStatusRecibo = async (codigo) => {
        const apiUrl = `https://gestaointegration.azurewebsites.net/api/recibo/${codigo}`;

        const status = await fetch(apiUrl).then(function (response) {
            if (response.ok) {
                const currentStatus = response.json().then((data) => {
                    const dataRecibo = new Date(data.dataRecibo).toLocaleDateString();
                    return `Recibo ${data.numeroRecibo}/${data.anoRecibo} enviado em ${dataRecibo}`;
                });
                return currentStatus;
            } else {
                return '';
            }
        })
            .catch(function (error) {
                console.log('There has been a problem with your fetch operation: ' + error.message);
            });

        return status;
    }

    function preencherPopup(JsonDados) {
        document.getElementById('ReciboNome').value = JsonDados.DadosCliente.Nome;
        document.getElementById('ReciboPlano').value = JsonDados.DadosRecibo["Plano de contas"];
        document.getElementById('ReciboData').value = JsonDados.DadosRecibo["Data de confirmação"];
        document.getElementById('ReciboValorTotal').value = JsonDados.DadosRecibo["Valor total"];
        document.getElementById('ReciboDescricao').value = JsonDados.DadosRecibo["Descrição do recebimento"] + " - " + JsonDados.DadosRecibo["Observações"];
        document.getElementById('ReciboEmail').value = JsonDados.DadosCliente["E-mail"];
        document.getElementById('ReciboTelefone').value = JsonDados.DadosCliente.Celular;
        document.getElementById('ReciboStatus').value = JsonDados.ReciboStatus;
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

        preencherPopup(JSON);
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



    function waitRequestsResult() {
        window.DadosRecibo = null;
        window.DadosCliente = null;
        let interval = setInterval(function () {
            if (window.DadosRecibo && window.DadosCliente) {
                clearInterval(interval);
            }
        }, 500);

    }


    function criarPopUp() {
        let popup = htmlToElement('<div class="bootbox modal fade in" tabindex="-1" role="dialog" aria-hidden="false" id="enviarEmail"> <div class="modal-dialog modal-lg"> <div class="modal-content"> <div class="modal-header"> <button type="button" class="bootbox-close-button close" data-dismiss="modal" aria-hidden="true">×</button> <h3 class="modal-title" id="titulo">Enviar Recibo</h3> <h6 style="color: green;" id="ReciboStatus"></h6> </div><div class="modal-body"> <div class="bootbox-body"> <section class="content" style="margin-bottom: 10px; padding-bottom: 10px;"> <div class="box"> <div class="row"> <div class="col-sm-12 col-lg-12 col-md-12"> <form action="" role="form" target="imprimir-recibo" id="MovimentacoesFinanceiraImprimirReciboForm" method="post" accept-charset="utf-8" _lpchecked="1"> <div style="display:none;" wfd-invisible="true"> <input type="hidden" name="_method" value="PUT"> </div><input type="hidden" name="imprimir" value="1" autocomplete="off" id="MovimentacoesFinanceiraImprimir" wfd-invisible="true"> <div class="required form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboNome">Nome do Cliente</label> <input name="nome" maxlength="100" value="" required="required" class="required form-control" autocomplete="off" type="text" id="ReciboNome" placeholder=""> </div><div class="required form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboPlano">Plano de Contas</label> <input name="plano" maxlength="30" value="" required="required" class="required form-control" autocomplete="off" type="text" id="ReciboPlano" placeholder="" readonly> </div><div class="required form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboData">Data do pagamento</label> <input name="data" maxlength="10" value="" required="required" class="required datepicker mascara-data form-control" autocomplete="off" type="text" id="ReciboData" placeholder=""> </div><div class="required form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboValorTotal">Valor</label> <input name="valor" required="required" class="mascara-valor required form-control" autocomplete="off" type="text" value="" id="ReciboValorTotal" placeholder=""> </div><div class="col-sm-12 col-lg-12 col-md-12 required"> <label for="ReciboDescricao">Descrição</label> <textarea name="descricao" class="form-control" autocomplete="off" cols="30" rows="6" id="ReciboDescricao" required="required"></textarea> </div><div class="col-sm-12 col-lg-12 col-md-12"> <hr> </div><div class="form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboEmail">E-mail</label> <input name="plano" maxlength="30" value="" class="form-control" autocomplete="off" type="text" id="ReciboEmail" placeholder="" readonly> </div><div class="form-group col-sm-6 col-lg-6 col-md-6"> <label for="ReciboTelefone">Número Telefone</label> <input name="telefone" maxlength="30" value="" class="form-control" autocomplete="off" type="text" id="ReciboTelefone" placeholder="" readonly> </div><div class="form-group col-sm-6 col-lg-6 col-md-6 margin-top-10px"> <button class="btn btn-primary" type="submit"> <span class="glyphicon glyphicon-envelope margin-right-10px"></span>Enviar notificação </button> <a href="javascript:parent.bootbox.hideAll();" class="btn btn-danger"> <span class="glyphicon glyphicon-remove margin-right-10px"></span>Cancelar </a> </div><div class="form-group col-sm-6 col-lg-6 col-md-6 margin-top-10px"> <button class="btn btn-secondary float-right margin-right-10px" type="submit"> <span class="glyphicon glyphicon-envelope margin-right-10px"></span>Enviar via e-mail </button> <button class="btn btn-secondary float-right margin-right-10px" type="submit"> <span class="glyphicon glyphicon-envelope margin-right-10px"></span>Enviar via whatsapp </button> </div></form> </div></div></div></section> </div></div></div></div></div>');
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

    var tabelaRecebimentos = document.getElementById("recebimentos");
    var menuSuspenso = tabelaRecebimentos.getElementsByClassName("dropdown-menu");
    var popup = criarPopUp();
    document.body.append(popup);
    for (var i = 0; i < menuSuspenso.length; i++) {
        //Verifica se o pagamento está na situação confirmado pelo seletor de classe de sucesso
        if (menuSuspenso[i].closest('tr').querySelector('.label-success')) {
            inserirEnviarRecebimento(menuSuspenso[i], i);
        }
    }
})();
