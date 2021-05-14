const definition = require('./definition.js')

const User = definition.foreignModel('users', 'User')

const JoinRequest = definition.model({
  name: "JoinRequest",
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
    state: {
      type: String,
      defaultValue: "new"
    }
  },
  indexes: {
    receivedJoinRequests: {
      property: "to"
    },
    sentJoinRequests: {
      property: "from"
    },
    receivedJoinRequestsByType: {
      property: ["to", "listType"]
    },
    sentJoinRequestsByType: {
      property: ["from", "listType"]
    },
    sentJoinRequestsByTypeList: {
      property: ["from", "listType", "list"]
    },
    listJoinRequests: {
      property: ["listType", "list"]
    },
    joinRequest: {
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
  name: "receivedJoinRequest",
  properties: {
    joinRequest: {
      type: JoinRequest
    }
  },
  returns: {
    type: JoinRequest
  },
  access: async (params, { client, visibilityTest }) => {
    if(!client.user) return false
    if(client.user && visibilityTest) return true
    let data = await JoinRequest.get(params.joinRequest)
    return data.to == client.user || data.from == client.user
  },
  async daoPath({ joinRequest }, {client, service}, method) {
    return JoinRequest.path(joinRequest)
  }
})

definition.view({
  name: "myJoinRequestsForList",
  properties: {
    list: {
      type: String,
      required: true
    },
    listType: {
      type: String,
      required: true
    }
  },
  returns: {
    type: Array,
    of: {
      type: JoinRequest
    }
  },
  access: async (params, { client, visibilityTest }) => {
    if(!client.user) return false
    if(client.user && visibilityTest) return true
    return true
  },
  async daoPath({ listType, list }, {client, service}, method) {
    return JoinRequest.indexRangePath("sentJoinRequestsByTypeList", [client.user, listType, list])
  }
})

definition.view({
  name: "receivedJoinRequests",
  properties: {},
  returns: {
    type: Array,
    of: {
      type: JoinRequest
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ }, {client, service}, method) {
    return JoinRequest.indexRangePath("receivedJoinRequests", [client.user])
  }
})

definition.view({
  name: "receivedJoinRequestsByList",
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
      type: JoinRequest
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ listType, list }, {client, service}, method) {
    return JoinRequest.indexRangePath("joinRequest", [client.user, listType, list])
  }
})

definition.view({
  name: "sentJoinRequests",
  properties: {},
  returns: {
    type: Array,
    of: {
      type: JoinRequest
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ }, {client, service}, method) {
    return JoinRequest.indexRangePath("sentJoinRequests", [client.user])
  }
})

definition.view({
  name: "receivedJoinRequestsByType",
  properties: {
    listType: {
      type: String
    }
  },
  returns: {
    type: Array,
    of: {
      type: JoinRequest
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ listType }, {client, service}, method) {
    return JoinRequest.indexRangePath("receivedJoinRequestsByType", [client.user, listType])
  }
})

definition.view({
  name: "sentJoinRequestsByType",
  properties: {
    listType: {
      type: String
    }
  },
  returns: {
    type: Array,
    of: {
      type: JoinRequest
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ listType }, {client, service}, method) {
    return JoinRequest.indexRangePath("sentJoinRequestsByType", [client.user, listType])
  }
})

definition.event({
  name: "joinRequestRemoved",
  async execute({ joinRequest }) {
    await JoinRequest.delete(joinRequest)
  }
})

definition.event({
  name: "joinRequestAccepted",
  async execute({ joinRequest }) {
    await JoinRequest.update(joinRequest, { state: "accepted" })

  }
})

definition.event({
  name: "joinRequestDeclined",
  async execute({ joinRequest }) {
    await JoinRequest.update(joinRequest, { state: "declined" })
  }
})

definition.event({
  name: "joinRequestAdded",
  async execute({ from, to, listType, list }) {
    await JoinRequest.create({
      id: `${from}_${to}_${listType}_${list}`,
      from, to, listType, list, state:"new"
    })
  }
})

definition.action({
  name: "declineJoinRequest",
  properties: {
    joinRequest: {
      type: JoinRequest
    }
  },
  access: async ({ joinRequest }, { client, visibilityTest }) => {
    if(!client.user) return false
    if(visibilityTest) return true
    const joinRequestRow = await JoinRequest.get(joinRequest)
    if(!joinRequestRow) throw new Error("notFound")
    return joinRequestRow.to == client.user
  }, // only for logged in
  async execute({ joinRequest }, { client, service }, emit) {
    emit({
      type: "joinRequestDeclined",
      joinRequest
    })
  }
})

definition.action({
  name: "acceptJoinRequest",
  properties: {
    joinRequest: {
      type: JoinRequest
    }
  },
  access: async ({ joinRequest }, { client, visibilityTest }) => {
    if(!client.user) return false
    if(visibilityTest) return true
    const joinRequestRow = await JoinRequest.get(joinRequest)
    if(!joinRequestRow) throw new Error("notFound")
    return joinRequestRow.to == client.user
  }, // only for logged in
  async execute({ joinRequest }, { client, service }, emit) {
    const joinRequestRow = await JoinRequest.get(joinRequest)
    const triggerResults = await service.trigger({
      type: "JoinRequestAccepted_"+joinRequestRow.listType,
      list: joinRequestRow.list,
      role: 'member',
      from: joinRequestRow.from,
      to: joinRequestRow.to,
      joinRequestId: joinRequestRow.id
    })
    console.log("TRIG RES", triggerResults)
    if(!triggerResults) { // no support, auto add membership
      emit({
        type: "membershipAdded",
        user: joinRequestRow.from,
        role: 'member',
        listType: joinRequestRow.listType,
        list: joinRequestRow.list,
      })
    }
    emit({
      type: "joinRequestAccepted",
      joinRequest
    })

    service.trigger({
      type: "Notify",
      user: joinRequestRow.from,
      notificationType: "joinRequestAccepted",
      data: {
        listType: joinRequestRow.listType,
        list: joinRequestRow.list,
        from: joinRequestRow.to,
        to: joinRequestRow.from
      }
    })

  }
})

module.exports = { JoinRequest }
