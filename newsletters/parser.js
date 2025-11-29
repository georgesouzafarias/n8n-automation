function parseRawContent(listContentRaw) {
	let parsedContent = [];

	listContentRaw.forEach((element) => {
		parsedContent.push({
			newsTitle: element.title,
			newsContentSnippet: element.contentSnippet,
			newsPublishDate: element.isoDate,
			newsLink: element.link,
		});
	});

	return parsedContent;
}

function processData(listContentRaw) {
	let totalContent = listContentRaw.length;
	let parsedContent = parseRawContent(listContentRaw);

	summary = {
		totalContent: totalContent,
		listContent: parsedContent,
	};

	return summary;
}

let newsRawData;

// Valida se é local ou está rodando no n8n.
if (typeof $input === 'undefined') {
	console.log('Ambiente local detectado, carregando data.json');
	const fs = require('fs');
	let localData = JSON.parse(fs.readFileSync('./output.json', 'utf8'));

	$input = {
		json: localData,
	};
	console.log('Arquivo data.json carregado com sucesso');
	newsRawData = $input.json[0].newsRawData;
} else {
	newsRawData = $input.first().json.newsRawData;
}

let processedData = processData(newsRawData);

if (typeof module !== 'undefined' && module.exports) {
	const fs = require('fs');

	fs.writeFileSync('./result.json', JSON.stringify(processedData, null, 2));

	module.exports = { processedData };
} else {
	return { processedData }; // n8n
}
