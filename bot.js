// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        // create a QnAMaker connector
        this.QnAMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions);
        // create a DentistScheduler connector
        this.DentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration)
        // create a IntentRecognizer connector
        this.IntentRecognizer = new IntentRecognizer(configuration.LuisConfiguration);

        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            const QnAResults = await this.QnAMaker.getAnswers(context);
            // send user input to IntentRecognizer and collect the response in a variable
            const LuisResults = await this.IntentRecognizer.executeLuisQuery(context)
            // get the top intent from the luis result
            const topIntent = LuisResults.luisResult.prediction.topIntent
            
            let messageOutput;
            // determine which service to respond with based on the results from LUIS //
            if (LuisResults.intents[topIntent].score > .8) {
                const time = await this.IntentRecognizer.getTimeEntity(LuisResults);
                const date = await this.IntentRecognizer.getDateEntity(LuisResults);
                if (topIntent === 'getAvailability') {
                    messageOutput = await this.DentistScheduler.getAvailability(time);
                } else {
                    messageOutput = await this.DentistScheduler.scheduleAppointment(time, date);
                };
            } else if (QnAResults[0]) {
                messageOutput = QnAResults[0].answer;
            } else {
                messageOutput = `I'm not sure I can answer your question`
                + 'I can help you schedule appointments'
                + `Or you can ask me questions about the dentistry`
            };
            await context.sendActivity(messageOutput);
            await next();
        });
             
        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = `Hello, welcome to Contoso Dentistry assistant. I can help you schdule appointments or
                            get some basic info about the dentistry treatment and who can be treated. How can I help
                            you today?`;
        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}

module.exports.DentaBot = DentaBot;
