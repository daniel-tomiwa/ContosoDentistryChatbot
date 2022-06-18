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

            // determine which service to respond with based on the results from LUIS //
            if (LuisResults.luisResult.prediction.topIntent === "getAvailability" &&
                LuisResults.intents.getAvailability.score > .8
            ) {
                const timeEntity = await this.IntentRecognizer.getTimeEntity(LuisResults);
                // call api with time entity info
                const getAvailabilityResult = await this.DentistScheduler.getAvailability();
                console.log(getAvailabilityResult)
                await context.sendActivity(getAvailabilityResult);
                await next();
                return;
            } else if (LuisResults.luisResult.prediction.topIntent === "scheduleAppointment" &&
                       LuisResults.intents.scheduleAppointment.score > .8
            ) {
                const timeEntity = await this.IntentRecognizer.getTimeEntity(LuisResults);
                // call api with time entity info
                const scheduleAppointmentResult = await this.DentistScheduler.scheduleAppointment(timeEntity);
                console.log(scheduleAppointmentResult)
                await context.sendActivity(scheduleAppointmentResult);
                await next();
                return;
            }

            // If an answer was received from QnA Maker, send the answer back to the user.
            if (QnAResults[0]) {
                await context.sendActivity(`${QnAResults[0].answer}`);
            }
            else {
                // If no answers were returned from QnA Maker, reply with help.
                await context.sendActivity(`I'm not sure I can answer your question`
                    + 'I can help you schedule appointments'
                    + `Or you can ask me questions about the dentistry`);
            }
            await next();
            // if(top intent is intentA and confidence greater than 50){
            //  doSomething();
            //  await context.sendActivity();
            //  await next();
            //  return;
            // }
            // else {...}
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
