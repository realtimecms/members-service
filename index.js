const app = require('./app.js')

const definition = require('./definition.js')
const autoSecurityProcessor = require('../security-service/autoSecurity.js')

const { Membership } = require("./membership.js")
const { Invitation } = require("./invitations.js")
require("./joinRequest.js")
const { EmailInvitation } = require("./emailInvitations.js")

const User = definition.foreignModel('users', 'User')

definition.trigger({
  name: "MemberInvite",
  properties: {
    listType: {
      type: String
    },
    list: {
      type: String
    },
    role: {
      type: String
    },
    to: {
      type: User
    },
    from: {
      type: User
    }
  },
  async execute({ to, listType, list, from, role }, { client, service }, emit) {
    const user = await User.get(to)
    if(!user) throw new Error("notFound")

    const invitationData = {
      to, from, listType, list, role
    }
    service.trigger({
      type: "Notify",
      user: user.id,
      notificationType: "invite",
      data: invitationData
    })
    emit([{
      type: "invitationAdded",
      ...invitationData
    }])
    return { type: "user", user: user.id }
  }
})

definition.trigger({
  name: "MemberEmailInvite",
  properties: {
    listType: {
      type: String
    },
    list: {
      type: String
    },
    email: {
      type: String
    },
    role: {
      type: String
    },
    from: {
      type: User
    }
  },
  async execute({ email, listType, list, from, role }, { client, service }, emit) {
    const users = await User.indexRangeGet("email", email)
    const user = users[0]
    if(user) {
      const existingMembership =
          await Membership.indexObjectGet("membership", [user.id, listType, list])
      if (existingMembership) throw ({ properties: { email: "alreadyMember" } })

      const existingInvitation =
        await Invitation.indexObjectGet("invitation", [user.id, listType, list])
      if (existingInvitation) throw ({ properties: { email: "alreadyInvited" } })

      const invitationData = {
        to: user.id,
        from, listType, list, role
      }
      console.error("INVITATION DATA", invitationData)
      service.trigger({
        type: "Notify",
        user: user.id,
        notificationType: "invite",
        data: invitationData
      })
      emit([{
        type: "invitationAdded",
        ...invitationData
      }])
      return { type: "user", user: user.id }
    } else {
      const existingInvitation =
          await EmailInvitation.indexObjectGet("emailInvitation", [email, listType, list])
      if (existingInvitation) throw ({ properties: { email: "alreadyInvited" } })

      const code = app.generateUid()
      emit([{
        type: "emailInvitationAdded",
        from, email, code, listType, list, role
      }])
      return { type: "email", code }
    }
  }
})

module.exports = definition

async function start() {
  app.processServiceDefinition(definition, [ ...app.defaultProcessors, autoSecurityProcessor ])
  await app.updateService(definition)//, { force: true })
  const service = await app.startService(definition, { runCommands: true, handleEvents: true })

  /*require("../config/metricsWriter.js")(definition.name, () => ({

  }))*/
}


if (require.main === module) start().catch( error => { console.error(error); process.exit(1) })
