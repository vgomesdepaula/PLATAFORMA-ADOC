/**
 * BACKEND ADOC-UERN (Google Apps Script)
 * 
 * Este script recebe os dados do prontuário (via JSON/POST)
 * do frontend (index.html), cria um novo Documento na pasta "ADOC",
 * preenche com as informações clínicas e devolve o Link do novo Prontuário gerado.
 */

function doPost(e) {
  try {
    // 1. Receber os dados do Frontend
    const data = JSON.parse(e.postData.contents);
    
    // 2. Procurar ou criar a pasta "ADOC"
    const folderName = "ADOC";
    const folders = DriveApp.getFoldersByName(folderName);
    let targetFolder;
    
    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = DriveApp.createFolder(folderName);
    }
    
    // 3. Criar um novo Documento Google
    const pacienteNome = data.nome || 'Sem_Nome';
    const fileName = `Prontuário - ${pacienteNome} - ${new Date().toLocaleDateString('pt-BR')}`;
    
    const doc = DocumentApp.create(fileName);
    const body = doc.getBody();
    
    // 4. Mover o arquivo para a pasta ADOC
    const docFile = DriveApp.getFileById(doc.getId());
    docFile.moveTo(targetFolder);
    
    // 5. Preencher o conteúdo do Prontuário
    body.insertParagraph(0, `PRONTUÁRIO MÉDICO - ADOC-UERN`)
        .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    
    body.appendParagraph(`Data: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`);
    body.appendParagraph(`Paciente: ${pacienteNome}`);
    body.appendParagraph(`Prontuário/Registro: ${data.prontuario || 'Não informado'}`);
    body.appendParagraph(`Forma Clínica: ${data.formaClinica || 'Não informada'}`);
    body.appendParagraph(`Idade/Procedência: ${data.idade || '--'} / ${data.procedencia || '--'}\n`);
    
    body.appendParagraph(`ANAMNESE`).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(`Queixa Principal (QP): ${data.qp || 'Não relatada.'}`);
    body.appendParagraph(`HMA: ${data.hma || 'Não relatada.'}`);
    body.appendParagraph(`Antecedentes: ${data.antecedentes || 'Não relatados.'}\n`);
    
    body.appendParagraph(`EPIDEMIOLOGIA (CHAGAS)`).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(`Casa de taipa: ${data.taipa || 'Não informada.'}`);
    body.appendParagraph(`Contato Vetor: ${data.contatoVetor || 'Nega contato.'}\n`);
    
    body.appendParagraph(`EXAME FÍSICO`).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(`Sinais Vitais: PA ${data.pa || '--'} | FC ${data.fc || '--'} | SatO2 ${data.sat || '--'} | Peso ${data.peso || '--'}`);
    body.appendParagraph(`Cardiovascular: ${data.acv || 'Regular, sem achados significativos.'}`);
    body.appendParagraph(`Respiratório: ${data.ar || 'Regular, sem achados significativos.'}\n`);
    
    body.appendParagraph(`ESCALAS CLÍNICAS`).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(`Escore de Rassi: ${data.rassi || '--'}`);
    body.appendParagraph(`Índice Cardiotorácico: ${data.ict || '--'}\n`);
    
    // Salvar as alterações no Docs
    doc.saveAndClose();
    
    // 6. Retornar a URL de sucesso para o site
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      url: doc.getUrl() 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Caso dê erro (permissões...)
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: error.toString(),
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const folderName = "ADOC";
    const folders = DriveApp.getFoldersByName(folderName);
    
    if (!folders.hasNext()) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', patients: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const targetFolder = folders.next();
    const files = targetFolder.getFilesByType(MimeType.GOOGLE_DOCS);
    
    const patients = [];
    let count = 0;
    
    while (files.hasNext() && count < 50) { 
      const file = files.next();
      
      // Tentar abrir o documento para ler os detalhes (pode ser lento para muitos arquivos, limitado a 50)
      let name = file.getName();
      let record = '--';
      let form = '--';
      let age = '--';
      let region = '--';
      
      try {
        const doc = DocumentApp.openById(file.getId());
        const text = doc.getBody().getText();
        
        const nameMatch = text.match(/Paciente:\s*(.*)/);
        const recordMatch = text.match(/Prontuário\/Registro:\s*(.*)/);
        const formMatch = text.match(/Forma Clínica:\s*(.*)/);
        const idadeProcedenciaMatch = text.match(/Idade\/Procedência:\s*(.*?)\s*\/\s*(.*)/);
        
        if (nameMatch) name = nameMatch[1].trim();
        if (recordMatch) record = recordMatch[1].trim();
        if (formMatch) form = formMatch[1].trim();
        if (idadeProcedenciaMatch) {
            age = idadeProcedenciaMatch[1].trim();
            region = idadeProcedenciaMatch[2].trim();
        }
      } catch (err) {
        // Ignora erro ao ler arquivo específico (ex: formato inválido)
      }
      
      patients.push({
        id: file.getId(),
        name: name,
        record: record,
        form: form,
        age: age,
        region: region,
        url: file.getUrl(),
        createdAt: file.getDateCreated().toISOString()
      });
      
      count++;
    }
    
    // Opcional: ordenar pelos mais recentes primeiro
    patients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      patients: patients 
    })).setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Necessário para permitir as conexões do Frontend do navegador (CORS)
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Allow-Origin', '*');
}
