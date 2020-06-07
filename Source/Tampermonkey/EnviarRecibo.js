// ==UserScript==
// @name         Imprimir comprovante
// @namespace    http://tampermonkey.net/
// @version      0.7
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
        return JSONResultado;
    }

    function preencherPopup(JsonDados) {
        document.getElementById('ReciboNome').value = JsonDados.DadosCliente.Nome;
        document.getElementById('ReciboPlano').value = JsonDados.DadosRecibo["Plano de contas"];
        document.getElementById('ReciboData').value = JsonDados.DadosRecibo["Data de confirmação"];
        document.getElementById('ReciboValorTotal').value = JsonDados.DadosRecibo["Valor total"];
        document.getElementById('ReciboDescricao').value = JsonDados.DadosRecibo["Descrição do recebimento"] + " - " + JsonDados.DadosRecibo["Observações"];
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
        let popup = htmlToElement('<div class="bootbox modal fade in" tabindex="-1" role="dialog" aria-hidden="false" id="enviarEmail"> <div class="modal-dialog modal-lg"> <div class="modal-content"> <div class="modal-header"><button type="button" class="bootbox-close-button close" data-dismiss="modal" aria-hidden="true">×</button> <h3 class="modal-title">Enviar Recibo</h3> </div><div class="modal-body"> <div class="bootbox-body"> <section class="content"> <div class="box"> <div class="row"> <div class="col-sm-12 col-lg-12 col-md-12"> <form action="/recibo/zb3X3e" role="form" target="imprimir-recibo" id="MovimentacoesFinanceiraImprimirReciboForm" method="post" accept-charset="utf-8" _lpchecked="1"> <div style="display:none;" wfd-invisible="true"><input type="hidden" name="_method" value="PUT"></div><input type="hidden" name="imprimir" value="1" autocomplete="off" id="MovimentacoesFinanceiraImprimir" wfd-invisible="true"> <div class="required form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboNome">Nome do Cliente</label><input name="nome" maxlength="100" value="" required="required" class="required form-control" autocomplete="off" type="text" id="ReciboNome" placeholder="" style="background-image: url(&quot;data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABHklEQVQ4EaVTO26DQBD1ohQWaS2lg9JybZ+AK7hNwx2oIoVf4UPQ0Lj1FdKktevIpel8AKNUkDcWMxpgSaIEaTVv3sx7uztiTdu2s/98DywOw3Dued4Who/M2aIx5lZV1aEsy0+qiwHELyi+Ytl0PQ69SxAxkWIA4RMRTdNsKE59juMcuZd6xIAFeZ6fGCdJ8kY4y7KAuTRNGd7jyEBXsdOPE3a0QGPsniOnnYMO67LgSQN9T41F2QGrQRRFCwyzoIF2qyBuKKbcOgPXdVeY9rMWgNsjf9ccYesJhk3f5dYT1HX9gR0LLQR30TnjkUEcx2uIuS4RnI+aj6sJR0AM8AaumPaM/rRehyWhXqbFAA9kh3/8/NvHxAYGAsZ/il8IalkCLBfNVAAAAABJRU5ErkJggg==&quot;); background-repeat: no-repeat; background-attachment: scroll; background-size: 16px 18px; background-position: 98% 50%; cursor: auto;"> </div><div class="required form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboPlano">Plano de Contas</label><input name="plano" maxlength="30" value="" required="required" class="required form-control" autocomplete="off" type="text" id="ReciboPlano" placeholder=""> </div><div class="required form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboData">Data do pagamento</label><input name="data" maxlength="10" value="" required="required" class="required datepicker mascara-data form-control" autocomplete="off" type="text" id="ReciboData" placeholder=""></div><div class="required form-group col-sm-6 col-lg-6 col-md-6"><label for="ReciboValorTotal">Valor</label><input name="valor" required="required" class="mascara-valor required form-control" autocomplete="off" type="text" value="" id="ReciboValorTotal" placeholder=""> </div><div class="col-sm-12 col-lg-12 col-md-12 required"><label for="ReciboDescricao">Descrição</label><textarea name="descricao" class="form-control" autocomplete="off" cols="30" rows="6" id="ReciboDescricao" required="required"></textarea></div><div class="both col-sm-12 col-lg-12 col-md-12 margin-top-10px"> <button class="btn btn-primary" type="submit"><span class="glyphicon glyphicon-envelope margin-right-10px"></span>Enviar via e-mail</button><a href="javascript:parent.bootbox.hideAll();" class="btn btn-danger"><span class="glyphicon glyphicon-remove margin-right-10px"></span>Cancelar</a> </div></form> </div></div></div></section> </div></div></div></div></div>');
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
