function createElementWithStyles(tag, styles) {
    const element = document.createElement(tag);
    Object.assign(element.style, styles);
    return element;
}

let chatAberto = false;

const chatButton = document.createElement('button');
chatButton.innerText = '☰ Precisa de ajuda?';
chatButton.id = 'chatButton';
chatButton.style.position = 'fixed';
chatButton.style.fontSize = '16px';
chatButton.style.width = '200px';
chatButton.style.bottom = '20px';
chatButton.style.right = '20px';
chatButton.style.backgroundColor = '#e1762a';
chatButton.style.color = '#fff';
chatButton.style.fontWeight = '600';
chatButton.style.padding = '20px';
chatButton.style.border = 'none';
chatButton.style.borderRadius = '5px';
chatButton.style.cursor = 'pointer';
chatButton.style.fontFamily = 'Segoe UI';
document.body.appendChild(chatButton);

const chatContainer = document.createElement('div');
chatContainer.id = 'chatContainer';
chatContainer.style.display = 'none';
chatContainer.style.position = 'fixed';
chatContainer.style.bottom = '20px';
chatContainer.style.marginTop = '10px';
chatContainer.style.right = '20px';
chatContainer.style.width = '300px';
chatContainer.style.backgroundColor = '#343434';
chatContainer.style.border = '1px solid #707b7c';
chatContainer.style.borderRadius = '5px';
chatContainer.style.padding = '21px';
chatContainer.style.boxShadow = '0px 4px 8px rgba(0, 0, 0, 0.1)';
chatContainer.style.fontFamily = 'Segoe UI';
chatContainer.style.overflow = 'hidden';
document.body.appendChild(chatContainer);

const minimizeButton = document.createElement('button');
minimizeButton.innerText = 'X';
minimizeButton.style.fontWeight = '600';
minimizeButton.id = 'minimizeButton';
minimizeButton.style.position = 'absolute';
minimizeButton.style.top = '6px';
minimizeButton.style.width = '36px';
minimizeButton.style.right = '6px';
minimizeButton.style.backgroundColor = '#e1762a';
minimizeButton.style.color = '#fff';
minimizeButton.style.padding = '8px';
minimizeButton.style.border = 'none';
minimizeButton.style.borderRadius = '5px';
minimizeButton.style.cursor = 'pointer';
minimizeButton.style.display = 'none';
minimizeButton.style.fontFamily = 'Segoe UI';
chatContainer.appendChild(minimizeButton);

const chatContent = document.createElement('div');
chatContent.id = 'chatContent';
chatContent.style.color = '#fff';
chatContent.style.overflowY = 'auto';
chatContent.style.fontWeight = '400';
chatContent.style.maxHeight = 'calc(60vh)';
chatContent.style.transition = 'max-height 0.3s ease-in-out';
chatContent.style.paddingRight = '10px';
chatContent.style.marginTop = '30px';
chatContainer.appendChild(chatContent);

chatContent.innerHTML += "<p>Em caso de dúvidas sobre NCM, digite sua NCM. Caso seja outra dúvida, fique à vontade para perguntar.</p>";

const inputPergunta = document.createElement('textarea');
inputPergunta.id = 'pergunta';
inputPergunta.placeholder = 'Digite sua pergunta';
inputPergunta.style.marginTop = '10px';
inputPergunta.style.padding = '12px';
inputPergunta.style.width = '100%';
inputPergunta.style.border = '1px solid #2980b9';
inputPergunta.style.borderRadius = '5px';
inputPergunta.style.fontSize = '14px';
inputPergunta.style.boxSizing = 'border-box';
inputPergunta.style.color = '#333';
inputPergunta.style.outline = 'none';
inputPergunta.style.border = 'none';
inputPergunta.style.fontFamily = 'Segoe UI';
chatContainer.appendChild(inputPergunta);

chatButton.addEventListener('click', function () {
    chatContainer.style.display = 'block';
    minimizeButton.style.display = 'block';
    chatButton.style.display = 'none';
    inputPergunta.focus();
});

minimizeButton.addEventListener('click', function () {
    chatContainer.style.display = 'none';
    minimizeButton.style.display = 'none';
    chatButton.style.display = 'block';
});

inputPergunta.addEventListener('keyup', function (event) {
    if (event.key === 'Enter') {
        enviarPergunta();
        chatContent.scrollTop = chatContent.scrollHeight;
    }
});

function ajustarAlturaChat() {
    chatContent.style.maxHeight = 'calc(80vh - 42px)';
}

function enviarPergunta() {
    const pergunta = inputPergunta.value.trim();
    const chatContent = document.getElementById('chatContent');

    if (!pergunta) {
        chatContent.innerHTML += "<p style='color: red;'>Por favor, digite uma pergunta.</p>";
        ajustarAlturaChat();
        return;
    }

    chatContent.scrollTop = chatContent.scrollHeight;

    const container = document.createElement('div');
    container.classList.add('pergunta-resposta');
    chatContent.appendChild(container);

    const spinner = document.createElement('div');
    spinner.style.display = 'inline-block';
    spinner.style.border = '4px solid rgba(231, 118, 42, 0.3)';
    spinner.style.borderTop = '4px solid #e1762a';
    spinner.style.borderRadius = '50%';
    spinner.style.width = '20px';
    spinner.style.height = '20px';
    spinner.style.animation = 'spin 1s linear infinite';
    container.appendChild(spinner);

 
    if (pergunta.toLowerCase().includes('ncm')) {
        container.innerHTML += "<p><strong>Você:</strong> " + pergunta + "</p>";
        container.innerHTML += "<p><strong>Resposta:</strong> Opções relacionadas à NCM.</p>";
        container.innerHTML += "<p>1: Descrição da NCM</p>";
        container.innerHTML += "<p>2: Alíquota de ICMS</p>";
        container.innerHTML += "<p>3: MVA</p>";
    } else {
        container.innerHTML += "<p><strong>Você:</strong> " + pergunta + "</p>";
        container.innerHTML += "<p><strong>Resposta:</strong> Opção não reconhecida. Em caso de dúvidas sobre NCM, digite sua NCM. Caso seja outra dúvida, fique à vontade para perguntar.</p>";
    }

    ajustarAlturaChat();

    chatContent.scrollTop = chatContent.scrollHeight;

    inputPergunta.value = '';
}
