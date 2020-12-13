const app = require('./app.js')

const definition = require('./definition.js')

const User = definition.foreignModel('users', 'User')

const Invitation = definition.model({
  name: "Invitation",
  properties: {
    from: {
      type: User,
      validation: ['nonEmpty']
    },
    to: {
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
    },
    state: {
      type: String,
      defaultValue: "new"
    }
  },
  indexes: {
    receivedInvitations: {
      property: "to"
    },
    sentInvitations: {
      property: "from"
    },
    receivedInvitationsByType: {
      property: ["to", "listType"]
    },
    sentInvitationsByType: {
      property: ["from", "listType"]
    },
    listInvitations: {
      property: ["listType", "list"]
    },
    invitation: {
      property: ["to", "listType", "list"]
    },
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
  name: "receivedInvitation",
  properties: {
    invitation: {
      type: Invitation
    }
  },
  returns: {
    type: Invitation
  },
  access: async (params, { client, visibilityTest }) => {
    if(!client.user) return false
    if(client.user && visibilityTest) return true
    let data = await Invitation.get(params.invitation)
    return data.to == client.user
  },
  async daoPath({ invitation }, {client, service}, method) {
    return Invitation.path(invitation)
  }
})

definition.view({
  name: "receivedInvitations",
  properties: {},
  returns: {
    type: Array,
    of: {
      type: Invitation
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ }, {client, service}, method) {
    return Invitation.indexRangePath("receivedInvitations", [client.user])
  }
})

definition.view({
  name: "sentInvitations",
  properties: {},
  returns: {
    type: Array,
    of: {
      type: Invitation
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ }, {client, service}, method) {
    return Invitation.indexRangePath("sentInvitations", [client.user])
  }
})

definition.view({
  name: "receivedInvitationsByType",
  properties: {
    listType: {
      type: String
    }
  },
  returns: {
    type: Array,
    of: {
      type: Invitation
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ listType }, {client, service}, method) {
    return Invitation.indexRangePath("receivedInvitationsByType", [client.user, listType])
  }
})

definition.view({
  name: "sentInvitationsByType",
  properties: {
    listType: {
      type: String
    }
  },
  returns: {
    type: Array,
    of: {
      type: Invitation
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ listType }, {client, service}, method) {
    return Invitation.indexRangePath("sentInvitationsByType", [client.user, listType])
  }
})

/*definition.view({
  name: "listInvitations",
  properties: {
    listType: {
      type: String
    },
    list: {
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
  async read({ listType, list }, {client, service}, method) {
    return Invitation.run(Invitation.table.getAll([ listType, list ], { index: "listInvitations" }))
  }
})*/


definition.event({
  name: "invitationRemoved",
  async execute({ invitation }) {
    await Invitation.delete(invitation)
  }
})

definition.event({
  name: "invitationAccepted",
  async execute({ invitation }) {
    await Invitation.update(invitation, { state: "accepted" })
  }
})

definition.event({
  name: "invitationDeclined",
  async execute({ invitation }) {
    await Invitation.update(invitation, { state: "declined" })
  }
})

definition.event({
  name: "invitationAdded",
  async execute({ from, to, listType, list, role }) {
    await Invitation.create({
      id: `${from}_${to}_${listType}_${list}`,
      from, to, listType, list, role, state:"new"
    }, { conflict: "replace" })
  }
})

definition.event({
  name: "invitationRoleChanged",
  async execute({ invitation, role }) {
    await Invitation.update(invitation, { role })
  }
})

definition.action({
  name: "declineInvitation",
  properties: {
    invitation: {
      type: Invitation
    }
  },
  access: async ({ invitation }, { client, visibilityTest }) => {
    if(!client.user) return false
    if(visibilityTest) return true
    const invitationRow = await Invitation.get(invitation)
    if(!invitationRow) throw new Error("notFound")
    return invitationRow.to == client.user
  }, // only for logged in
  async execute({ invitation }, { client, service }, emit) {
    emit({
      type: "invitationDeclined",
      invitation
    })
  }
})

definition.action({
  name: "acceptInvitation",
  properties: {
    invitation: {
      type: Invitation
    }
  },
  access: async ({ invitation }, { client, visibilityTest }) => {
    if(!client.user) return false
    if(visibilityTest) return true
    const invitationRow = await Invitation.get(invitation)
    if(!invitationRow) throw new Error("notFound")
    return invitationRow.to == client.user
  }, // only for logged in
  async execute({ invitation }, { client, service }, emit) {
    const invitationRow = await Invitation.get(invitation)
    const triggerResults = await service.trigger({
      type: "InvitationAccepted_"+invitationRow.listType,
      list: invitationRow.list,
      role: invitationRow.role,
      from: invitationRow.from,
      to: invitationRow.to,
      invitationId: invitationRow.id
    })
    console.log("TRIG RES", triggerResults)
    if(!triggerResults) { // no support, auto add membership
      emit({
        type: "membershipAdded",
        user: invitationRow.to,
        role: invitationRow.role,
        listType: invitationRow.listType,
        list: invitationRow.list,
      })
    }
    emit({
      type: "invitationAccepted",
      invitation
    })
  }
})

module.exports = { Invitation }
