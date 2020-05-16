// ==UserScript==
// @name         Imprimir comprovante
// @namespace    http://tampermonkey.net/
// @version      0.5
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

    var HttpClient = function () {
        this.get = function (aUrl, aCallback) {
            var anHttpRequest = new XMLHttpRequest();
            anHttpRequest.onreadystatechange = function () {
                if (anHttpRequest.readyState == 4 && anHttpRequest.status == 200) {
                    aCallback(anHttpRequest.responseText);
                }
            }

            anHttpRequest.open("GET", aUrl, true);
            anHttpRequest.send(null);
        }
    }

    function getContatosCliente(linkCliente) {
        let request = new HttpClient();
        console.log("getContatosCliente: " + linkCliente);
        request.get(linkCliente, function (resultText) {
            let htmlResult = htmlToElement(resultText);
            let usefullProperties = ['Código', 'Nome', 'Celular', 'E-mail', 'Membro'];
            return tabularSearch(htmlResult, usefullProperties);
        });
    }

    function getPropriedadesRecibo(linkDetalhes) {
        let request = new HttpClient();
        console.log("GetPropriedadesRecibo: " + linkDetalhes);
        request.get(linkDetalhes, parsePropriedadesRecibo);
    }

    function parsePropriedadesRecibo(responseText) {
        let baseDocument = htmlToElement(responseText);
        window.globalvar = baseDocument;
        let usefullProperties = ['Código', 'Descrição do recebimento', 'Plano de contas', 'Data do vencimento', 'Data de confirmação', 'Cliente', 'Observações'];
        var thCliente = document.evaluate("//*/th[text()='Cliente']", baseDocument, null, XPathResult.ANY_TYPE, null).iterateNext();
        if (thCliente) {
            var link = thCliente.closest('tr').querySelector('a').href;
            if (link) {
                getContatosCliente(link);
            }
        }
        return tabularSearch(baseDocument, usefullProperties);
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
                console.log(nomePropriedade + " Extraído do HTML");
            }
            if (usefullProperties.includes(nomePropriedade)) {
                console.log(nomePropriedade + " Encontrada dentro do array de proprieades a serem buscadas");
                var fieldPropriedade = allProperties[i].getElementsByTagName('td');
                if (fieldPropriedade && fieldPropriedade.length > 0) {
                    var valor = fieldPropriedade[0].innerText.trim();
                    console.log(valor + " Extraído do HTML para a propriedade: " + nomePropriedade);
                    if (valor) {
                        returnJson[nomePropriedade] = valor;
                    }
                }
            }
        }
        console.log(returnJson);
        return returnJson;
    }

    function getTransactionDetailsLink(actionMenu) {
        var visualizarAction = actionMenu.querySelector('a[href*="visualizar_recebimento"]');
        return visualizarAction.href;
    }

    function createEnviarRecebimento(link) {
        var listItem = document.createElement('li');
        var anchor = document.createElement('a');
        anchor.onclick = function () { getPropriedadesRecibo(link); };
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

    for (var i = 0; i < menuSuspenso.length; i++) {
        //Verifica se o pagamento está na situação confirmado pelo seletor de classe de sucesso
        if (menuSuspenso[i].closest('tr').querySelector('.label-success')) {
            inserirEnviarRecebimento(menuSuspenso[i], i);
        }
    }
})();
