const definition = require('./definition.js')

const User = definition.foreignModel('users', 'User')

const Membership = definition.model({
  name: "Membership",
  properties: {
    user: {
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
    time: {
      type: Date
    }
  },
  indexes: {
    userMemberships: {
      property: "user"
    },
    userMembershipsByType: {
      property: ["user", "listType"]
    },
    userMembershipsByTypeTime: {
      property: ["user", "listType", "time"]
    },
    userMembershipsByTypeRole: {
      property: ["user", "listType", "role"]
    },
    listMembershipsByTypeRole: {
      property: ["listType", "list", "role"]
    },
    userMembershipsByTypeRoleTime: {
      property: ["user", "listType", "role", "time"]
    },
    listMembers: {
      property: ["listType", "list"]
    },
    membership: {
      property: ["user", "listType", "list"]
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
  name: "myMemberships",
  properties: {},
  returns: {
    type: Array,
    of: {
      type: Membership
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ }, {client, service}, method) {
    return Membership.indexRangePath("userMemberships", [client.user])
  }
})

definition.view({
  name: "myMembershipsByType",
  properties: {
    listType: {
      type: String
    }
  },
  returns: {
    type: Array,
    of: {
      type: Membership
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ listType }, {client, service}, method) {
    return Membership.indexRangePath("userMembershipsByType", [client.user, listType])
  }
})

definition.view({
  name: "myMembershipsByTypeRole",
  properties: {
    listType: {
      type: String
    },
    role: {
      type: String
    }
  },
  returns: {
    type: Array,
    of: {
      type: Membership
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ listType, role }, {client, service}, method) {
    return Membership.indexRangePath("userMembershipsByTypeRole", [client.user, listType, role])
  }
})

definition.view({
  name: "myMembershipsByTypeTime",
  properties: {
    listType: {
      type: String
    },
    from: {
      type: Date
    },
    to: {
      type: Date
    },
    limit: {
      type: Number
    }
  },
  returns: {
    type: Array,
    of: {
      type: Membership
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath(params, {client, service}, method) {
    return Membership.indexRangePath("userMembershipsByTypeTime", {
      gte: `${JSON.stringify(client.user)}:${JSON.stringify(params.listType)}:`
        +(params.from ? JSON.stringify(params.from) : ''),
      lte: `${JSON.stringify(client.user)}:${JSON.stringify(params.listType)}:`
          +(params.to ? JSON.stringify(params.to) : '\xFF\xFF\xFF\xFF'),
      limit: params.limit
    })
  }
})

definition.view({
  name: "myMembershipsByTypeRoleTime",
  properties: {
    listType: {
      type: String
    },
    role: {
      type: String
    },
    from: {
      type: Date
    },
    to: {
      type: Date
    }
  },
  returns: {
    type: Array,
    of: {
      type: Membership
    }
  },
  access: (params, { client }) => !!client.user, // only for logged in
  async daoPath(params, {client, service}, method) {
    return Membership.indexRangePath("userMembershipsByTypeRoleTime", {
      gte: `${JSON.stringify(client.user)}:${JSON.stringify(params.listType)}:${JSON.stringify(params.role)}:`
          +(params.from ? JSON.stringify(params.from) : ''),
      lte: `${JSON.stringify(client.user)}:${JSON.stringify(params.listType)}:${JSON.stringify(params.role)}:`
          +(params.to ? JSON.stringify(params.to) : '\xFF\xFF\xFF\xFF'),
      limit: params.limit
    })
  }
})

definition.view({
  name: "listMembershipsByTypeRole",
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
  },
  returns: {
    type: Array,
    of: {
      type: Membership
    }
  },
  async daoPath({ listType, list, role }, {client, service}, method) {
    return Membership.indexRangePath("listMembershipsByTypeRole", [ listType, list, role ])
  }
})

definition.view({
  name: "userMembershipsByType",
  properties: {
    user: {
      type: User
    },
    listType: {
      type: String
    }
  },
  returns: {
    type: Array,
    of: {
      type: Membership
    }
  },
  async daoPath({ user, listType }, {client, service}, method) {
    return Membership.indexRangePath("userMembershipsByType", [ user, listType ])
  }
})

definition.view({
  name: "myMembership",
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
      type: Object,
      properties: {
        user: { type: User },
        listType: { type: String },
        list: { type: String },
        role: { type: String }
      }
    }
  },
  access: (params, { client }) => {
    return !!client.user
  }, // only for logged in
  async daoPath({ listType, list }, {client, service}, method) {
    return Membership.indexRangePath("membership", [ client.user, listType, list ])
  }
})

definition.view({
  name: "listMembers",
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
      type: Membership
    }
  },
  //access: (params, { client }) => !!client.user, // only for logged in
  async daoPath({ listType, list }, {client, service}, method) {
    return Membership.indexRangePath("listMembers", [ listType, list ])
  }
})

definition.trigger({
  name: "MemberJoinRequest",
  properties: {
    listType: {
      type: String
    },
    list: {
      type: String
    },
    from: {
      type: User
    }
  },
  async execute({ listType, list, from }, { client, service }, emit) {
    const toUserMemberships = await Membership.indexRangetGet(
        "listMembershipsByTypeRole", [ listType, list, 'owner' ])
    if(toUserMemberships.length == 0) {
      console.error('JOIN REQUEST SENT TO LIST WITHOUT OWNERS!!!', listType, list)
      // TODO some error - project doesn't have owner!
    }
    for(let toUserMembership of toUserMemberships){
      const toUser = toUserMembership.user;

      const joinRequestData = {
        to: toUser,
        from: from,
        listType, list
      }

      emit([{
        type: "joinRequestAdded",
        ...joinRequestData
      }])

      service.trigger({
        type: "Notify",
        user: toUser,
        notificationType: "joinRequest",
        data: joinRequestData
      })
    }
    return 'ok'
  }
})

definition.event({
  name: "membersListDeleted",
  async execute({ listType, list }) {
    await Membership.indexRangeDelete('listMembers', [ listType, list ])
  }
})

definition.event({
  name: "membershipRemoved",
  async execute({ membership }) {
    await Membership.delete(membership)
  }
})

definition.event({
  name: "membershipAdded",
  async execute(data) {
    const { user, listType, list, role } = data
    const id = `${user}_${listType}_${list}`
    let insertData = {
      id,
      list, listType, user, role
    }
    if(data.time) insertData.time = data.time
    await Membership.create(insertData)
  }
})

definition.event({
  name: "membershipRoleChanged",
  async execute({ membership, role }) {
    await Membership.update(membership, { role })
  }
})
definition.event({
  name: "membershipTimeChanged",
  async execute({ membership, time }) {
    await Membership.update(membership, { time })
  }
})
definition.event({
  name: "listTimeChanged",
  async execute({ listType, list, time }) {
    await Membership.indexRangeUpdate("listMembers", { time }, [ listType, list ])
  }
})

definition.action({
  name: "removeMe",
  properties: {
    membership: {
      type: Membership
    }
  },
  access: async ({ membership }, { client, visibilityTest }) => {
    if(!client.user) return false
    if(visibilityTest) return true
    const membershipRow = await Membership.get(membership)
    if(!membershipRow) throw new Error("notFound")
    if(membershipRow.user == client.user) return true
  },
  async execute({ membership }, { client, service }, emit) {
    /// TODO: check if exists
    const cursor = await Membership.get(membership)
    if (cursor.listType === 'Project'){
      service.triggerService('events', {
        type: 'ProjectLeft',
        project: cursor.list,
        user: cursor.user
      })
    }

    emit({
      type: "membershipRemoved",
      membership
    })
  }
})

definition.trigger( {
  name: "MembersListDeleted",
  properties: {
    listType: {
      type: String
    },
    list: {
      type: String
    }
  },
  async execute({ listType, list }, { client, service }, emit) {
    emit({
      type: "membersListDeleted",
      listType,
      list
    })
  }
})

definition.trigger( {
  name: "EventLeft",
  properties: {
    user: {
      type: String
    },
    event: {
      type: String
    }
  },
  async execute({ user, event }, { client, service }, emit) {
    const membership = await Membership.get(user + '_Event_' + event)
    if(membership) {
      emit({
        type: "membershipRemoved",
        membership
      })
    }
  }
})

module.exports = { Membership }
