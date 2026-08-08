# Capturing money messages on iOS with Shortcuts

iOS never lets an app read your SMS. No permission exists, for any app, native
or web. So Moat cannot pull messages from Messages.

Shortcuts can. You configure the automation yourself, and it hands the message
to Moat. The app still never reads your inbox.

## Why the message cannot go straight into the capture inbox

A Shortcut cannot write into the app's storage. There is no API for it. Four
channels exist between a Shortcut and a web app, and each has a limit.

The clipboard holds one item. A new copy overwrites the last one.

A file holds as many messages as you like. The person must pick it.

A web address opens Safari. An installed web app on iOS keeps its data in a
separate store from Safari, so the message would arrive in an empty copy of the
app.

A web request needs a server. Moat keeps records on the device and encrypts
them with a key derived from your PIN. A server could not read or store them.

iOS Safari also does not support Web Share Target, so Moat cannot appear in the
iOS share sheet as a destination. That is the feature that would make this
automatic, and Apple has not shipped it.

So on the web app, the message waits until you open Moat. A native build removes
that wait, and the last section explains how.

## Route A — a messages file. Use this one.

This route loses nothing. Use it if you check the app every few days.

### What it does

Every matching message is appended to one text file. The file grows. Nothing
overwrites anything. You open Moat when you are ready and import the whole file
at once.

### Build it

1. Open Shortcuts. Go to the **Automation** tab. Tap **+**.
2. Choose **Message**.
3. Under **Sender**, add the senders you want. Use the exact sender IDs your
   bank and mobile money service use. Check your own Messages app for the exact
   text.
4. Choose **Run Immediately**. Turn **Notify When Run** off.
5. Add **Text**. Set its content to:
   `[Shortcut Input]` then a blank line.
6. Add **Append to Text File**. Point it at a file in iCloud Drive, for example
   `Moat/messages.txt`. Set **Make New File If Needed** on.
7. Save.

### Use it

Open Moat. Go to **Transactions**, then **Capture**, then **From a message**.
Use the file field and pick `messages.txt`. Moat reads the whole file and shows
every transaction for review.

Empty the file after an import, so the next import does not repeat what you
already posted.

### Why a file and not the clipboard

The clipboard holds exactly one message. If five arrive while you are away, four
are gone. A file holds all five, in order, with nothing lost.

## Route B — the clipboard. For one message, right now.

Use this when a payment just arrived and you want it recorded at once.

Build the same automation, but use **Copy to Clipboard** as the only action.
Then open Moat and tap **Paste from clipboard** on the capture screen. iOS shows
a paste confirmation, which no app can skip.

Do not use this route as your only capture path. It cannot hold more than one
message.

## Route C — a URL scheme. Needs a native build.

A native wrapper registers a scheme such as `moat://`, and it holds one store
rather than two.

The automation ends with **Open URL**:

```
moat://capture?text=[Shortcut Input]
```

Moat opens with the message loaded. No file, no paste, no confirmation.

This still needs you to unlock the phone and tap the notification. It is one
tap rather than several, not true background capture.

### What it costs

The Apple Developer Program is $99 per year. There is no free way to give a
native app to other people. A free Apple ID signs an app for 7 days on 3 of your
own devices, which is enough for you and not for a user.

Run Route A first. It tells you whether capture is the feature that makes Moat
stick, before you pay.

## What no route solves

None of them read old messages. All of them act on messages that arrive after
you build the automation.

None of them run when the automation is off or the phone is off. Treat capture
as a convenience. Treat the ledger as the record.
