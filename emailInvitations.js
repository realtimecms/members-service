const app = require('./app.js')

const definition = require('./definition.js')
const { Invitation } = require('./invitations.js')
const { Membership } = require('./membership.js')

const User = definition.foreignModel('users', 'User')

const EmailInvitation = definition.model({
  name: "EmailInvitation",
  properties: {
    from: {
      type: User,
      validation: ['nonEmpty']
    },
    email: {
      type: String,
      validation: ['nonEmpty', 'email']
    },
    code: {
      type: String,
      validation: ['nonEmpty']
    },
    listType: {
      type: String,
      validation: ['nonEmpty']
    },
    list: {
      type: String,
      validation: ['nonEmpty']
    },
    role: {
      type: String
    }
  },
  indexes: {
    sentInvitations: {
      property: "from"
    },
    sentInvitationsByType: {
      property: ["from", "listType"]
    },
    invitationByCode: {
      property: "code"
    },
    invitationsByEmail: {
      property: "email"
    },
    listInvitations: {
      property: ["listType", "list"]
    },
    emailInvitation: {
      property: ["email", "listType", "list"]
    }
  },
  crud: {
    deleteTrigger: true,
    options: { /// Crud only for admins
      access: (params, {client, service}) => { /// is it really needed?
        return client.roles && client.roles.includes('admin')
      }
    }
  }
})

definition.view({
  name: "sentEmailInvitations",
  properties: {},
  returns: {
    type: Array,
    of: {
      type: String
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ }, {client, service}, method) {
    return EmailInvitation.indexRangePath("sentInvitations", client.user)
  }
})

definition.view({
  name: "sentEmailInvitationsByType",
  properties: {
    listType: {
      type: String
    }
  },
  returns: {
    type: Array,
    of: {
      type: String
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ listType }, {client, service}, method) {
    return EmailInvitation.indexRangePath("sentInvitationsByType", [client.user, listType])
  }
})

definition.view({
  name: "invitationByCode",
  properties: {
    code: {
      type: String
    }
  },
  returns: {
    type: Invitation
  },
  async daoPath({ code }, {client, service}, method) {
    return EmailInvitation.path(code)
  }
})


definition.event({
  name: "emailInvitationRemoved",
  async execute({ invitation }) {
    await EmailInvitation.delete(invitation)
  }
})

definition.event({
  name: "emailInvitationAdded",
  async execute({ id, from, email, code, listType, list, role }) {
    await EmailInvitation.create({
      id: code, from, email, code, listType, list, role
    })
  }
})

definition.event({
  name: "emailInvitationRoleChanged",
  async execute({ invitation, role }) {
    await EmailInvitation.update(invitation, role )
  }
})


const Session = definition.foreignModel('session', 'Session')

const SessionInvitations = definition.model({ // obtained by code
  name: "SessionInvitations",
  properties: {
    session: {
      type: Session,
      validation: ["nonEmpty"]
    },
    invitations: {
      type: Array,
      of: {
        type: Object,
        properties: {
          from: {
            type: User,
            validation: ['nonEmpty']
          },
          listType: {
            type: String,
            validation: ['nonEmpty']
          },
          list: {
            type: String,
            validation: ['nonEmpty']
          },
          role: {
            type: String
          }
        }
      }
    }
  },
  crud: {
    deleteTrigger: true,
    options: { /// Crud only for admins
      access: (params, {client, service}) => { /// is it really needed?
        return client.roles && client.roles.includes('admin')
      }
    }
  }
})

definition.event({
  name: "sessionInvitationAdded",
  async execute({ session, invitation }) {
    await app.dao.request(['database', 'query', app.databaseName, `(${
        async (input, output, { table, session, invitation }) => {
          const value = await input.table(table).object(session).get()
          if(!value) {
            return await output.table(table).put({ id: session, session, invitations: [invitation] })
          } else {
            return await output.table(table).update(session, [
              { op:'addToSet', property: 'invitations', value: invitation } 
            ])
          }
        }
    })`, { table: SessionInvitations.tableName, session, invitation }])
  }
})

definition.event({
  name: "sessionInvitationRemoved",
  async execute({ session, invitation }) {
    await SessionInvitations.update(session, [{ op: 'deleteFromSet', property:'invitations', value: invitation }])
  }
})

definition.event({
  name: "sessionInvitationsRemoved",
  async execute({ session }) {
    await SessionInvitations.delete(session)
  }
})

definition.action({
  name: "useInvitationCode",
  properties: {
    code: {
      type: String
    },
    autoJoin: {
      type: Boolean
    }
  },
  async execute({ code, autoJoin }, { client, service }, emit) {
    const invitations = await EmailInvitation.table.indexRangeGet("invitationByCode", code)
    const invitation = invitations[0]
    if(!invitation) throw "notFound"
    if(!client.user) {
      emit([{
        type: "sessionInvitationAdded",
        session: client.sessionId,
        invitation
      }/*,{
        type: "emailInvitationRemoved",
        invitation: invitation.id
      }*/])
      return {"type": "session"}
    } else { // user logged in so transform email invitation directly to invitation
      const memberships = await Membership.indexRangeGet(
          "membership", [client.user, invitation.listType, invitation.list])
      const membership = memberships[0]
      if(!membership) {
        if(autoJoin) {
          emit({
            type: "membershipAdded",
            user: client.user,
            role: invitation.role,
            listType: invitation.listType,
            list: invitation.list,
          })
          return {"type": "joined"}
        } else {
          service.trigger({
            type: "Notify",
            user,
            notificationType: "invite",
            data: invitation
          })
          emit([{
            type: "invitationAdded",
            from: invitation.from,
            to: client.user,
            role: invitation.role,
            listType: invitation.listType,
            list: invitation.list
          }])
          return {"type": "invitation", invitation: id}
        }
      }
      return {"type": "none"}
    }
  }
})

definition.trigger({
  name: "OnLogin",
  properties: {
    user: {
      type: User
    },
    session: {
      type: Session
    }
  },
  async execute({ user, session, userData }, { client, service }, emit) {
    const sessionInvitations = await SessionInvitations.get(session)
    if(!sessionInvitations) return
    const invitations = sessionInvitations.invitations

    let invitationEvents = []
    let listSet = new Set()
    for(let invitation of invitations) {
      if(listSet.has([invitation.listType, invitation.list])) continue;
      listSet.add([invitation.listType, invitation.list])

      service.trigger({
        type: "Notify",
        user,
        notificationType: "invite",
        data: invitation
      })
      invitationEvents.push({
        type: "invitationAdded",
        from: invitation.from,
        to: user,
        role: invitation.role,
        listType: invitation.listType,
        list: invitation.list
      })
    }
    invitationEvents.push({
      type: "sessionInvitationsRemoved",
      session
    })
    emit(invitationEvents)
  }
})

definition.trigger({
  name: "OnRegister",
  properties: {
    user: {
      type: User
    },
    session: {
      type: Session
    },
    userData: {
      type: Object,
      properties: {
        email: {
          type: String
        }
      }
    }
  },
  async execute({ user, session, userData }, context, emit) {
    if(userData.email) {
      const invitations = await EmailInvitation.indexRangeGet('invitationsByEmail', userData.email)

      let invitationEvents = []
      let listSet = new Set()
      for(let invitation of invitations) {
        if(listSet.has([invitation.listType, invitation.list])) continue;
        listSet.add([invitation.listType, invitation.list])

        invitationEvents.push({
          type: "invitationAdded",
          from: invitation.from,
          to: user,
          role: invitation.role,
          listType: invitation.listType,
          list: invitation.list
        })

        /*invitationEvents.push({
          type: "emailInvitationRemoved",
          invitation: invitation.id
        })*/
      }
      emit(invitationEvents)
    }
  }
})

module.exports = { EmailInvitation }