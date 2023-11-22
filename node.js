const express = require('express');
const fs = require('fs/promises');
const papaparse = require('papaparse');
const bodyParser = require('body-parser');
const axios = require('axios');
const unidecode = require('unidecode');
const app = express();
require('dotenv').config();
const sql = require('mssql');
const port = process.env.PORT || 5000;
const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const SQL_SERVER_CONNECTION_STRING = process.env.SQLServer;

const palavrasBloqueadas = ['penis', 'buceta'];
app.use(bodyParser.json());
const config = {
  server: process.env.SQLServer.split(';')[0].split('=')[1],
  database: process.env.SQLServer.split(';')[1].split('=')[1],
  user: process.env.SQLServer.split(';')[2].split('=')[1],
  password: process.env.SQLServer.split(';')[3].split('=')[1],
  options: {
    encrypt: true,
    enableArithAbort: true,
    multipleActiveResultSets: true,
  },
};


let dfInternas, dfInterestaduais, historico;

const loadCSVData = async () => {
  try {
    await sql.connect(config);
    console.log('Conexão com o SQL Server estabelecida com sucesso.');

    const resultInternas = await sql.query` select distinct ncm_e.uf sigla, ncm_e.estado estado, concat((first_value(aliquotas) over (partition by uf order by count(*) desc)), '%') icms
    from ncm_aliquotas ncm_a
    inner join ncm_estados ncm_e on ncm_a.idEstado = ncm_e.idEstado
    group by uf, estado, aliquotas
    `;
    dfInternas = resultInternas.recordset;

    const resultInterestaduais = await sql.query`select g_e_o.sigla sigla_origem, g_e_o.estado estado_origem, g_e_d.sigla sigla_destino, g_e_d.estado estado_destino, concat(ai.aliquota, '%') aliquota 
    from [ST].[Aliquota.Interestadual] ai 
    left join [Geral].[Estado] g_e_o on g_e_o.id = ai.id_origem
    left join [Geral].[Estado] g_e_d on g_e_d.id = ai.id_destino`;
    dfInterestaduais = resultInterestaduais.recordset;

    console.log('Dados carregados com sucesso.');

  } catch (err) {
    console.error('Erro ao conectar com o SQL Server ou ao carregar os dados:', err);
  }
};

function isWholeWord(word, str) {
  const regex = new RegExp(`(\\b|\\W)${word}(\\b|\\W)`, 'gi');
  return regex.test(str);
}

function findStates(input, states) {
  const foundStates = [];

  // Primeiro, procurar pelos nomes completos dos estados na string de entrada
  for (const state of states) {
    if (input.includes(state.nome) && state.nome !== 'para') {
      foundStates.push(state);
    }
  }

  // Se não encontrar nomes completos, procurar pelas siglas que formam palavras inteiras
  if (foundStates.length === 0) {
    for (const state of states) {
      if (isWholeWord(state.sigla, input)) {
        foundStates.push(state);
      }
    }
  }

  console.log("Input:", input); // Para depuração
  console.log("Estados Encontrados:", foundStates); // Para depuração

  return foundStates;
}




function normalizeString(str) {
  return unidecode(str).toLowerCase().replace(/\W+/g, ' ').trim();
}

const loadHistorico = async () => {
  try {
    historico = JSON.parse(await fs.readFile('historico_perguntas_respostas.json', 'utf-8'));
  } catch (err) {
    historico = [];
    console.error('Erro ao carregar o histórico:', err);
  }
};





app.post('/api/chatbot/responder', async (req, res) => {
  const user_input = req.body.pergunta?.trim() || '';
  const normalized_input = normalizeString(user_input);
  const containsNcm = /ncm/i.test(normalized_input);

  if (!user_input) {
    return res.status(400).json({ "error": "A pergunta não pode estar vazia." });
  }

  if (containsNcm) {
    // Usar uma expressão regular mais flexível para extrair NCM e UF
    const ncmMatch = user_input.match(/ncm (\d{4}\.\d{2}\.\d{2}) (de|do|da) ([A-Za-z]{2})/i);
    if (ncmMatch && ncmMatch.length === 4) {
        const ncm = ncmMatch[1]; 
        const uf = ncmMatch[3].toUpperCase(); // Extrai a UF do match e converte para maiúsculas

      console.log('NCM:', ncm);
      console.log('UF:', uf);
      // Executar consulta SQL no banco de dados
      try {
        await sql.connect(config);
        const result = await sql.query`
        select ncm_sub.subItem 'ncm', ncm_e.uf, ncm_a.aliquotas 'aliquota', ncm_a.notas 'nota'
        from [ncm_subitem] ncm_sub
        inner join [ncm_aliquotas] ncm_a on ncm_sub.idSubItem = ncm_a.idSubItem
        inner join [ncm_estados] ncm_e on ncm_a.idEstado = ncm_e.idEstado
        where ncm_sub.subItem = '${ncm}' and ncm_e.uf = ${uf}
    `;
    
    if (result.recordset.length > 0) {
        const resposta = `A resposta relacionada ao NCM ${ncm} do ${uf} é: ${result.recordset[0].aliquota}`;
          historico.push({ "pergunta": user_input, "resposta": resposta });
          await fs.writeFile('historico_perguntas_respostas.json', JSON.stringify(historico, null, 4), 'utf-8');
          return res.json({ "resposta": resposta });
        } 
      } catch (err) {
        console.error('Erro ao executar consulta SQL:', err);
        return res.status(500).json({ "error": "Erro ao consultar o banco de dados." });
      }
    } else {
      return res.status(400).json({ "error": "Não foi possível extrair NCM e UF da pergunta." });
    }
  }
  for (const palavra of palavrasBloqueadas) {
    if (normalized_input.includes(palavra)) {
      return res.status(400).json({ "error": "O conteúdo da sua pergunta contém palavras não permitidas." });
    }
  }

  if (!dfInternas || !dfInterestaduais) {
    return res.status(500).json({ "error": "Dados não disponíveis. Não foi possível carregar as alíquotas." });
  }

  const estadosInternos = dfInternas.map(row => {
    return {
      sigla: row.sigla.toLowerCase(),
      nome: normalizeString(row.estado)
    };
  });


  // Primeiro procurar por siglas de estados
  let estadosEncontrados = findStates(normalized_input, estadosInternos);

  // Se não encontrar siglas, procurar pelos nomes dos estados
 
  if (estadosEncontrados.length === 1) {
    const internal = dfInternas.find(row => row.sigla.toLowerCase() === estadosEncontrados[0].sigla);
    const resposta = `A aliquota interna de ICMS de ${internal.estado} (${internal.sigla}) é ${internal.icms}. Lembre-se de verificar com um especialista para informações atualizadas.`;
    historico.push({ "pergunta": user_input, "resposta": resposta });
    await fs.writeFile('historico_perguntas_respostas.json', JSON.stringify(historico, null, 4), 'utf-8');
    return res.json({ "resposta": resposta });
  }if (estadosEncontrados.length === 2) {
    let origem = estadosEncontrados[0].sigla;
    let destino = estadosEncontrados[1].sigla;
    
    if (normalized_input.indexOf(origem) > normalized_input.indexOf(destino)) {
      [origem, destino] = [destino, origem];
    }
    
    console.log('Origem:', origem);
    console.log('Destino:', destino);
    
    const rowInterestadual = dfInterestaduais.find(row => 
      row.sigla_origem?.toLowerCase() === origem && row.sigla_destino?.toLowerCase() === destino
    );
    
    
    console.log('Row Interestadual:', rowInterestadual);
    
    if (rowInterestadual) {
      const resposta = `A alíquota interestadual de ICMS de ${rowInterestadual.estado_origem} para ${rowInterestadual.estado_destino} é ${rowInterestadual.aliquota}. Lembre-se de verificar com um especialista para informações atualizadas.`;
      historico.push({"pergunta": user_input, "resposta": resposta});
      await fs.writeFile('historico_perguntas_respostas.json', JSON.stringify(historico, null, 4), 'utf-8');
      return res.json({"resposta": resposta});
    }
  }
  

  
  // Caso não encontre nas alíquotas internas, procura nas interestaduais
  // Implementar lógica semelhante à acima para dfInterestaduais

  // Se ainda não encontrar, buscar resposta do GPT-3
  try {
    const response = await axios.post(OPENAI_API_ENDPOINT, {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Você é um especialista em alíquotas do ICMS e legislação fiscal. Não responda nada em hipótese alguma sobre como preparar algo ou sobre receita de comida voce responde apenas sobre legislação fiscal e aliquotas" },
        { role: "user", content: user_input }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const resposta_gpt3 = response.data.choices[0].message.content.trim() + " Lembre-se de verificar com um especialista para informações atualizadas.";
    historico.push({ "pergunta": user_input, "resposta": resposta_gpt3 });
    await fs.writeFile('historico_perguntas_respostas.json', JSON.stringify(historico, null, 4), 'utf-8');
    res.json({ "resposta": resposta_gpt3 });
  } catch (err) {
    res.status(500).json({ "error": "Erro ao chamar a API do GPT-3: " + err.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor Node.js executando na porta ${port}`);
  loadCSVData();
});



loadHistorico();