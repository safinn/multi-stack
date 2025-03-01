import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { log } from '~/utils/logger.server'
import { SESEmailer } from './ses.server'

export interface EmailerClient {
  // Send an email to the specified email address with the specified template name.
  // The data object contains the placeholders keys and their values from the template.
  send: (to: string, subject: string, html: string, text: string) => Promise<void>
}

class Emailer {
  private client: EmailerClient

  constructor(client: EmailerClient) {
    this.client = client
  }

  async send(to: string, name: string, data?: Record<string, any>): Promise<void> {
    log.info(data, 'Email sent to %s with template: %s', to, name)
    const { NODE_ENV } = process.env
    const isDev = NODE_ENV === 'development'
    if (isDev) {
      return
    }

    // Read the subject, html, and text files from the email templates directory.
    let [subject, html, text] = await Promise.all([
      readFile(`app/email/templates/${name}.subject.txt`, { encoding: 'utf-8' }),
      readFile(`app/email/templates/${name}.html`, { encoding: 'utf-8' }),
      readFile(`app/email/templates/${name}.txt`, { encoding: 'utf-8' }),
    ])

    // Replace the placeholders in the subject, html, and text files with the data.
    for (const key in data) {
      const value = data[key]
      subject = subject.replaceAll(`{{${key}}}`, value)
      html = html.replaceAll(`{{${key}}}`, value)
      text = text.replaceAll(`{{${key}}}`, value)
    }

    return this.client.send(to, subject, html, text)
  }
}

// Replace the SESEmailer client with any implementation of EmailerClient.
const emailerClient = new SESEmailer()
export const emailer = new Emailer(emailerClient)
