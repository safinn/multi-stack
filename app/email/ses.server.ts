import type { SendEmailCommandInput, SESv2ClientConfig } from '@aws-sdk/client-sesv2'
import type { EmailerClient } from './emailer'
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'

export class SESEmailer implements EmailerClient {
  private client: SESv2Client

  constructor(...options: SESv2ClientConfig[]) {
    this.client = new SESv2Client(options)
  }

  async send(to: string, subject: string, html: string, text: string): Promise<void> {
    const input: SendEmailCommandInput = {
      FromEmailAddress: '',
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
          },
          Body: {
            Html: {
              Data: html,
            },
            Text: {
              Data: text,
            },
          },
        },
      },
    }
    const command = new SendEmailCommand(input)
    await this.client.send(command)
  }
}
