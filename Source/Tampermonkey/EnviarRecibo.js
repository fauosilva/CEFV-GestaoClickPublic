// ==UserScript==
// @name         Imprimir comprovante
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Script that injects a new action on the menu to send mail with the receipt.
// @author       Fabricio Oliveira Silva - fauosilva@gmail.com
// @match        https://gestaoclick.com/movimentacoes_financeiras/index_recebimento*
// @updateUrl    https://raw.githubusercontent.com/fauosilva/CEFV-GestaoClickPublic/master/Source/Tampermonkey/EnviarRecibo.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

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

    function getContatosCliente(baseDocument) {
        let usefullProperties = ['Código', 'Nome', 'Celular', 'E-mail'];
        return tabularSearch(baseDocument, usefullProperties);
    }

    function getPropriedadesRecibo(baseDocument) {
        let usefullProperties = ['Código', 'Descrição do recebimento', 'Plano de contas', 'Data do vencimento', 'Data de confirmação', 'Cliente', 'Observações'];
        return tabularSearch(baseDocument, usefullProperties);
        //let returnJson = {'Código' : '', 'Descrição do recebimento': '', 'Plano de contas': '', 'Data do vencimento': '', 'Data de confirmação': '', 'Cliente': '', 'Observações' : ''};
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
        return returnJson;
    }

    function getTransactionDetailsLink(actionMenu) {
        var visualizarAction = actionMenu.querySelector('a[href*="visualizar_recebimento"]');
        return visualizarAction.href;
    }

    function createEnviarRecebimento(link) {
        var listItem = document.createElement('li');
        var anchor = document.createElement('a');
        anchor.href = link + "?retorno=https://gestaoclick.com/movimentacoes_financeiras/index_recebimento";
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