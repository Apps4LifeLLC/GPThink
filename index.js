const { Configuration, OpenAIApi } = require("openai");
const readline = require("readline");
const util = require("util");
const fs = require('fs');








//

//CONFIGURE THESE VARIABLES AS DESIRED:

const API_KEY = "";//Your openAI API key here (alternatively this can be set, securely, in a .env file under 'API_KEY=______')
const gptModel = "gpt-3.5-turbo";

const maxThoughts = 15;
const thoughtRateLimit = 1;//seconds
const errorRetryDelay = 10;//seconds
const maxConsecutiveErrorsAllowed = 10;

//Follow me on Twitter @Valuable or Instagram @Albert

//








let apiKey;

try {
  const envFile = fs.readFileSync('.env', 'utf8');
  const envLines = envFile.split('\n');
  envLines.forEach((line) => {
    const [key, value] = line.split('=');
    process.env[key] = value;
  });

  apiKey = process.env.API_KEY;
} catch (error) {
  //console.log("Couldn't read .env file, using hardcoded API key");
}

if (!apiKey) {
  apiKey = API_KEY;
}

async function promptGPT(prompt, model = "gpt-3.5-turbo", max_tokens = 1000) {
  try {
    const configuration = new Configuration({
      apiKey: apiKey,
    });

    const openai = new OpenAIApi(configuration);

    const completion = await openai.createChatCompletion({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens,
    });

    const returnedValue = completion.data.choices[0].message;
    return returnedValue['content'];
  } catch (error) {
    throw error;
  }
}

function extractJSON(text) {

  const jsonStringRegex = /{[^]+?}/;
  const jsonStringMatch = text.match(jsonStringRegex);

  if (!jsonStringMatch) {
      return null;
  }

  const jsonString = jsonStringMatch[0];
  let jsonObject;
  
  try {
      jsonObject = JSON.parse(jsonString);
  } catch (error) {
      console.log(`JSON parse error: ${error}`);
      return null;
  }

  return jsonObject;
}

function questionPrompt(primaryObjective, summary, message) {
  return `I want to act out a scene with you. You and I are playing the part of advanced intellectuals. I am a very curious and inquisitive intellectual who is also very good at noticing patterns. You are a well versed intellectual with a near infinite knowledge on any topic. Though we are acting, I do want us to stay objective and realistic, don't make up non-sense. Everything we say should be truthful and also logically sound. In this scene we are going to start in the middle of a conversation we have already been having. To help with this I will provide a summary of what we have discussed so far, as well as our primary objective in this conversation.\nSummary:\n${"```"}${summary}${"```"}\nPrimary Objective:\n${"```"}${primaryObjective}${"```"}\nI will now continue the conversation with the following inquiry: ${"```"}${message}${"```"}. Before you reply, I want you to first re-summarize the entire conversation up until now, including my new inquiry. The summary should include lots of details so that a stranger could pick up the conversation where we left off, just from reading the summary. My inquiry must be included in the summary as the final sentence. The summary should be succinct, and under 1000 characters in length. Once you have a response in mind, make sure to express it in a succinct way which is under 150 characters in length. Your response shouldn't reference you or me or us, phrase everything as if you were simply thinking internally, talking to yourself. I want you to reply in JSON. The new summary should be stored under a key 'summary', whereas your response should be under a key 'message'. Please keep the primary objective in mind, your response should aim to get us one step closer towards our primary objective.`;
}

function answerPrompt(primaryObjective, summary, message) {
  return `I want to act out a scene with you. You and I are playing the part of advanced intellectuals. You are a very curious and inquisitive intellectual who is also very good at noticing patterns. I am a well versed intellectual with a near infinite knowledge on any topic. Though we are acting, I do want us to stay objective and realistic, don't make up non-sense. Everything we say should be truthful and also logically sound. In this scene we are going to start in the middle of a conversation we have already been having. To help with this I will provide a summary of what we have discussed so far, as well as our primary objective in this conversation.\nSummary:\n${"```"}${summary}${"```"}\nPrimary Objective:\n${"```"}${primaryObjective}${"```"}\nI will now continue the conversation with the following response: ${"```"}${message}${"```"}. Before you reply, I want you to first re-summarize the entire conversation up until now, including my new response. The summary should include lots of details so that a stranger could pick up the conversation where we left off, just from reading the summary. My response must be included in the summary as the final sentence. The summary should be succinct, and under 1000 characters in length. Once you have a follow up question in mind, make sure to express it in a succinct way which is under 150 characters in length. Your follow up question shouldn't reference you or me or us, phrase everything as if you were simply thinking internally, talking to yourself. I want you to reply in JSON. The new summary should be stored under a key 'summary', whereas your follow up question should be under a key 'message'. Please keep the primary objective in mind, your follow up questions should aim to get us one step closer towards our primary objective.`;
}

const setTimeoutPromise = util.promisify(setTimeout);

async function recursivePrompt(primaryObjective) {

  let thoughts = 0;
  let summary = "Salutations."
  let message = "Where do you think is a good place for us to begin?";
  let role = "question";

  let prompt = questionPrompt(primaryObjective, summary, message);
  let failureCount = 0;
  let thoughtChain = [];

  async function promptAndReply() {
    let success = false;

    while (!success) {
      try {
        const reply = await promptGPT(prompt, gptModel);
        const replyJSON = extractJSON(reply);

        if (
          replyJSON.hasOwnProperty('message') &&
          replyJSON.hasOwnProperty('summary') &&
          typeof replyJSON.message === 'string' &&
          typeof replyJSON.summary === 'string'
        ) {

          const message = replyJSON.message;
          const summary = replyJSON.summary;

          thoughtChain.push(message);

          console.clear()
          console.log(`Current Thought (${thoughts} of ${maxThoughts}): ${message}\n\n\nSummary of Thoughts: ${summary}\n\n\n\nIf you're enjoying this, please follow the creator of GPThink:\n• Twitter: @Valuable\n• Instagram: @Albert`);

          if (role === "question") {
            role = "answer";
            prompt = answerPrompt(primaryObjective, summary, message);
          } else if (role === "answer") {
            role = "question";
            prompt = questionPrompt(primaryObjective, summary, message);
          }

          thoughts++;
          await setTimeoutPromise(thoughtRateLimit*1000);
          failureCount = 0;
          success = true;

        } else {
          throw new Error('message or summary missing or invalid in JSON');
        }
      } catch (error) {
        console.log(`Error, trying again in ${errorRetryDelay} seconds`);
        //console.error("\n\n\nError: ", error);
        failureCount++;

        if (failureCount >= maxConsecutiveErrorsAllowed) {
          console.log("API limit reached. Final transcript will be displayed in 5 seconds.");
          await setTimeoutPromise(5*1000);
          success = true;//lazy approach to get the final transcript to log anyways, can clean up later
          thoughts = maxThoughts;//lazy approach to get the final transcript to log anyways, can clean up later
          break;
        }

        await setTimeoutPromise(errorRetryDelay*1000);
      }
    }

    if (success) {
      if (thoughts <= maxThoughts) {
        await promptAndReply();
      } else {
        console.clear()
        console.log(`Limit reached.\n\n\n\nPrimary Objective:\n\nUser: ${primaryObjective}\n\n\n\nTranscript of AI's thoughts:\n\nAI: ${thoughtChain.join('\n\nAI: ')}\n\n\n\nIf you like GPThink, please follow its creator on Twitter @Valuable or on Instagram @Albert\n\n\n\n`);
      }
    }

  }

  return promptAndReply();
}

(async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Please enter a primary objective.\
  \n\n\
  The primary objective should establish the intentions of the conversation\
  \n\n\
  Example: \"To discover new evidence in Ancient History of Alien Contact on Earth.\"\
  \n\n\n\n\
  Please type your primary objective: ", async (primaryObjective) => {
    await recursivePrompt(primaryObjective);
    rl.close();
  });
})();
