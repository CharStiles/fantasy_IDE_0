// OpenAI API Client file
require('dotenv').config();

const { Configuration, OpenAIApi } = require("openai");

const openai = new OpenAIApi(new Configuration({
	apiKey: process.env.OPENAI_API_KEY,
	organization: process.env.OPENAI_ORG_ID,
}));

// Here we set the system prompt as the first message of the conversation.

async function sendMessage(message) {

	const response = await openai.createChatCompletion({
		model: "gpt-4",
		messages:[{ role: 'user', content: message }],
		temperature: 1.4,
		max_tokens: 1900,
	});

	// Return the message returned by OpenAI deep into the response object
	return response.data.choices[0].message.content;
}

module.exports = sendMessage;