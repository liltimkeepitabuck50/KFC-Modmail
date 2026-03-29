// index.js
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionsBitField
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

const PREFIX = process.env.PREFIX || '!';
const COLOR = 0x457a49;

const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const GS_ROLE_ID = process.env.GS_ROLE_ID;
const COMM_ROLE_ID = process.env.COMM_ROLE_ID;
const S_ROLE_ID = process.env.S_ROLE_ID;
const LS_ROLE_ID = process.env.LS_ROLE_ID;

const userTicketMap = new Map();
const channelUserMap = new Map();
const ticketDepartmentMap = new Map();
const ticketClaimMap = new Map();

const DEPARTMENTS = {
  gs: {
    code: 'gs',
    name: 'General Support',
    roleId: GS_ROLE_ID
  },
  comm: {
    code: 'comm',
    name: 'Communications',
    roleId: COMM_ROLE_ID
  },
  s: {
    code: 's',
    name: 'Staffing',
    roleId: S_ROLE_ID
  },
  ls: {
    code: 'ls',
    name: 'Leadership Support',
    roleId: LS_ROLE_ID
  }
};

function createOpenTicketEmbed() {
  return {
    color: COLOR,
    title: 'Open a Ticket?',
    description: 'Thanks for contacting support.\nPress **Open Ticket** below to start a support ticket, or **Cancel** to stop.',
    footer: { text: 'ModMail System' }
  };
}

function createDepartmentSelectEmbed() {
  return {
    color: COLOR,
    title: 'What type of Support Ticket would you like to contact?',
    description: 'Please select the department that best matches your request from the dropdown below.',
    footer: { text: 'ModMail System' }
  };
}

function createTicketInfoEmbed(user, departmentCode) {
  const dept = DEPARTMENTS[departmentCode] || DEPARTMENTS.gs;
  return {
    color: COLOR,
    title: 'New Ticket Opened',
    thumbnail: user.displayAvatarURL({ size: 256 }),
    fields: [
      { name: 'User', value: `${user.tag}`, inline: true },
      { name: 'User ID', value: `${user.id}`, inline: true },
      { name: 'Department', value: dept.name, inline: true },
      { name: 'Status', value: 'Unclaimed', inline: true },
      { name: 'Opened', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
    ],
    footer: { text: 'ModMail System' }
  };
}

function createCommandsEmbed() {
  return {
    color: COLOR,
    title: 'ModMail Staff Commands',
    description: 'Here are the available staff commands for this ticket:',
    fields: [
      { name: '!reply <message>', value: 'Reply to the user through this ticket.', inline: false },
      { name: '!claim', value: 'Claim this ticket so staff knows who is handling it.', inline: false },
      { name: '!unclaim', value: 'Unclaim this ticket so someone else can take over.', inline: false },
      { name: '!connect', value: 'Notify the user that staff has connected to their ticket.', inline: false },
      { name: '!transfer <gs|comm|s|ls>', value: 'Transfer this ticket to another department.', inline: false }
    ],
    footer: { text: 'ModMail System' }
  };
}

function createCloseConfirmEmbed() {
  return {
    color: COLOR,
    title: 'Confirm Ticket Close',
    description: 'Are you sure you want to close this ticket?\nA transcript will be generated and archived.',
    footer: { text: 'ModMail System' }
  };
}

function createCloseCancelledEmbed() {
  return {
    color: COLOR,
    title: 'Close Cancelled',
    description: 'Ticket close has been cancelled.',
    footer: { text: 'ModMail System' }
  };
}

function createNoPermissionEmbed() {
  return {
    color: COLOR,
    title: 'Insufficient Permissions',
    description: 'You do not have permission to use this.',
    footer: { text: 'ModMail System' }
  };
}

function createInfoEmbed(description) {
  return {
    color: COLOR,
    description,
    footer: { text: 'ModMail System' }
  };
}

function getDepartmentFromValue(value) {
  switch (value) {
    case 'dept_gs':
      return 'gs';
    case 'dept_comm':
      return 'comm';
    case 'dept_s':
      return 's';
    case 'dept_ls':
      return 'ls';
    default:
      return 'gs';
  }
}

function getDepartmentSelectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_department')
      .setPlaceholder('Select a department...')
      .addOptions(
        {
          label: 'General Support',
          description: 'General questions, help, and support.',
          value: 'dept_gs'
        },
        {
          label: 'Communications',
          description: 'Public-facing, announcements, or communication-related issues.',
          value: 'dept_comm'
        },
        {
          label: 'Staffing',
          description: 'Staff applications, issues, or internal staffing matters.',
          value: 'dept_s'
        },
        {
          label: 'Leadership Support',
          description: 'High-level or sensitive issues for leadership only.',
          value: 'dept_ls'
        }
      )
  );
}

function getTicketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('claim_ticket')
      .setLabel('Claim')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('unclaim_ticket')
      .setLabel('Unclaim')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('show_commands')
      .setLabel('Show Commands')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
  );
}

function getOpenTicketButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('open_ticket')
      .setLabel('Open Ticket')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('cancel_open_ticket')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );
}

function getCloseConfirmButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('confirm_close_ticket')
      .setLabel('Confirm Close')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('cancel_close_ticket')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );
}

async function createTicketChannel(guild, user, departmentCode) {
  const dept = DEPARTMENTS[departmentCode] || DEPARTMENTS.gs;

  const baseOverwrites = [
    {
      id: guild.roles.everyone,
      deny: [PermissionsBitField.Flags.ViewChannel]
    },
    {
      id: client.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ManageMessages
      ]
    }
  ];

  if (departmentCode !== 'ls') {
    [GS_ROLE_ID, COMM_ROLE_ID, S_ROLE_ID, LS_ROLE_ID].forEach(roleId => {
      if (!roleId) return;
      baseOverwrites.push({
        id: roleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      });
    });
  } else {
    if (LS_ROLE_ID) {
      baseOverwrites.push({
        id: LS_ROLE_ID,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory
        ]
      });
    }
  }

  const channelName = `ticket-${dept.code}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${user.id}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID || null,
    permissionOverwrites: baseOverwrites
  });

  userTicketMap.set(user.id, channel.id);
  channelUserMap.set(channel.id, user.id);
  ticketDepartmentMap.set(channel.id, dept.code);

  const ticketInfoEmbed = new EmbedBuilder(createTicketInfoEmbed(user, dept.code));
  const commandsEmbed = new EmbedBuilder(createCommandsEmbed());
  const buttons = getTicketButtons();

  const deptRoleId = dept.roleId;
  const pingText = deptRoleId ? `<@&${deptRoleId}>` : '';

  await channel.send({
    content: pingText || null,
    embeds: [ticketInfoEmbed],
    components: [buttons]
  });

  await channel.send({
    embeds: [commandsEmbed]
  });

  return channel;
}

async function generateTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  let transcript = `Transcript for #${channel.name} (ID: ${channel.id})\n`;
  transcript += `Generated at: ${new Date().toISOString()}\n\n`;

  for (const msg of sorted) {
    const time = new Date(msg.createdTimestamp).toISOString();
    const author = `${msg.author.tag} (${msg.author.id})`;
    const content = msg.content || '';
    transcript += `[${time}] ${author}: ${content}\n`;
    if (msg.attachments.size > 0) {
      msg.attachments.forEach(att => {
        transcript += `  [Attachment] ${att.url}\n`;
      });
    }
  }

  return transcript;
}

async function sendTranscript(channel) {
  const logChannel = channel.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (!logChannel) return;

  const userId = channelUserMap.get(channel.id);
  const user = userId ? await client.users.fetch(userId).catch(() => null) : null;

  const transcriptText = await generateTranscript(channel);
  const buffer = Buffer.from(transcriptText, 'utf-8');

  const embed = new EmbedBuilder({
    color: COLOR,
    title: 'Ticket Closed & Transcript Generated',
    description: `A ticket has been closed and its transcript has been generated.`,
    fields: [
      { name: 'Channel', value: `${channel.name} (${channel.id})`, inline: false },
      { name: 'User', value: user ? `${user.tag} (${user.id})` : 'Unknown', inline: false }
    ],
    footer: { text: 'ModMail System' }
  });

  await logChannel.send({
    embeds: [embed],
    files: [{ attachment: buffer, name: `transcript-${channel.id}.txt` }]
  });
}

function isStaff(member) {
  if (!member) return false;
  const roleIds = [GS_ROLE_ID, COMM_ROLE_ID, S_ROLE_ID, LS_ROLE_ID].filter(Boolean);
  return member.roles.cache.some(r => roleIds.includes(r.id));
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.guild && message.content.startsWith(PREFIX)) {
    await handlePrefixCommand(message);
    return;
  }

  if (message.channel.type === ChannelType.DM) {
    const user = message.author;

    const existingChannelId = userTicketMap.get(user.id);
    if (existingChannelId) {
      const guild = client.guilds.cache.first();
      if (!guild) return;
      const ticketChannel = guild.channels.cache.get(existingChannelId);
      if (!ticketChannel) {
        userTicketMap.delete(user.id);
      } else {
        const embed = new EmbedBuilder({
          color: COLOR,
          author: { name: `${user.tag}`, iconURL: user.displayAvatarURL() },
          description: message.content || '*No content*',
          footer: { text: 'From User' }
        });

        await ticketChannel.send({ embeds: [embed] });

        if (message.attachments.size > 0) {
          message.attachments.forEach(async att => {
            await ticketChannel.send({ content: `Attachment from user: ${att.url}` });
          });
        }

        return;
      }
    }

    const openEmbed = new EmbedBuilder(createOpenTicketEmbed());
    const buttons = getOpenTicketButtons();

    await message.channel.send({
      embeds: [openEmbed],
      components: [buttons]
    });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    await handleButton(interaction);
  } else if (interaction.isStringSelectMenu()) {
    await handleSelectMenu(interaction);
  }
});

async function handleButton(interaction) {
  const { customId } = interaction;

  if (interaction.channel.type === ChannelType.DM) {
    if (customId === 'open_ticket') {
      const deptEmbed = new EmbedBuilder(createDepartmentSelectEmbed());
      const deptMenu = getDepartmentSelectMenu();

      await interaction.reply({
        embeds: [deptEmbed],
        components: [deptMenu],
        ephemeral: false
      });
    } else if (customId === 'cancel_open_ticket') {
      const embed = new EmbedBuilder(createInfoEmbed('Ticket creation cancelled.'));
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    return;
  }

  const member = interaction.member;
  const channel = interaction.channel;

  if (!channel || channel.type !== ChannelType.GuildText) return;

  if (!isStaff(member)) {
    const embed = new EmbedBuilder(createNoPermissionEmbed());
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === 'show_commands') {
    const embed = new EmbedBuilder(createCommandsEmbed());
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === 'claim_ticket') {
    const claimedBy = ticketClaimMap.get(channel.id);
    if (claimedBy && claimedBy === member.id) {
      const embed = new EmbedBuilder(createInfoEmbed('You have already claimed this ticket.'));
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
    ticketClaimMap.set(channel.id, member.id);

    const embed = new EmbedBuilder({
      color: COLOR,
      description: `This ticket has been claimed by ${member}.`,
      footer: { text: 'ModMail System' }
    });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (customId === 'unclaim_ticket') {
    const claimedBy = ticketClaimMap.get(channel.id);
    if (!claimedBy) {
      const embed = new EmbedBuilder(createInfoEmbed('This ticket is not claimed by anyone.'));
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
    if (claimedBy !== member.id) {
      const embed = new EmbedBuilder(createInfoEmbed('Only the staff member who claimed this ticket can unclaim it.'));
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
    ticketClaimMap.delete(channel.id);

    const embed = new EmbedBuilder({
      color: COLOR,
      description: `This ticket has been unclaimed by ${member}.`,
      footer: { text: 'ModMail System' }
    });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  if (customId === 'close_ticket') {
    const embed = new EmbedBuilder(createCloseConfirmEmbed());
    const buttons = getCloseConfirmButtons();

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: true
    });
    return;
  }

  if (customId === 'confirm_close_ticket') {
    await interaction.deferReply({ ephemeral: true });

    await sendTranscript(channel);

    const userId = channelUserMap.get(channel.id);
    if (userId) {
      userTicketMap.delete(userId);
    }
    channelUserMap.delete(channel.id);
    ticketDepartmentMap.delete(channel.id);
    ticketClaimMap.delete(channel.id);

    await interaction.editReply({
      embeds: [new EmbedBuilder(createInfoEmbed('Ticket closed and transcript generated.'))],
      components: []
    });

    setTimeout(() => {
      channel.delete().catch(() => {});
    }, 3000);

    return;
  }

  if (customId === 'cancel_close_ticket') {
    const embed = new EmbedBuilder(createCloseCancelledEmbed());
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }
}

async function handleSelectMenu(interaction) {
  if (interaction.customId !== 'select_department') return;
  if (interaction.channel.type !== ChannelType.DM) return;

  const user = interaction.user;
  const value = interaction.values[0];
  const deptCode = getDepartmentFromValue(value);

  const guild = client.guilds.cache.first();
  if (!guild) {
    await interaction.reply({
      embeds: [new EmbedBuilder(createInfoEmbed('No guild found for ticket creation.'))],
      ephemeral: true
    });
    return;
  }

  const existingChannelId = userTicketMap.get(user.id);
  if (existingChannelId) {
    const embed = new EmbedBuilder(createInfoEmbed('You already have an open ticket.'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  const channel = await createTicketChannel(guild, user, deptCode);

  const embed = new EmbedBuilder({
    color: COLOR,
    title: 'Ticket Created',
    description: `Your ticket has been created in **${guild.name}**.\nA staff member from **${DEPARTMENTS[deptCode].name}** will respond as soon as possible.`,
    footer: { text: 'ModMail System' }
  });

  await interaction.reply({ embeds: [embed], ephemeral: false });
}

async function handlePrefixCommand(message) {
  const { content, member, channel, guild } = message;
  if (!guild || !member) return;

  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (!isStaff(member)) return;

  const userId = channelUserMap.get(channel.id);
  const user = userId ? await client.users.fetch(userId).catch(() => null) : null;

  if (command === 'reply') {
    if (!user) {
      const embed = new EmbedBuilder(createInfoEmbed('No user is associated with this ticket.'));
      await message.reply({ embeds: [embed] });
      return;
    }

    const replyText = args.join(' ');
    if (!replyText) {
      const embed = new EmbedBuilder(createInfoEmbed('Please provide a message to send to the user.'));
      await message.reply({ embeds: [embed] });
      return;
    }

    const embedToUser = new EmbedBuilder({
      color: COLOR,
      author: { name: `${guild.name} Support`, iconURL: guild.iconURL() || undefined },
      description: replyText,
      footer: { text: 'Reply from Staff' }
    });

    await user.send({ embeds: [embedToUser] }).catch(() => {});

    const embedInTicket = new EmbedBuilder({
      color: COLOR,
      author: { name: `${member.user.tag}`, iconURL: member.user.displayAvatarURL() },
      description: replyText,
      footer: { text: 'To User' }
    });

    await channel.send({ embeds: [embedInTicket] });
    await message.react('📨');
  }

  if (command === 'claim') {
    const claimedBy = ticketClaimMap.get(channel.id);
    if (claimedBy && claimedBy === member.id) {
      const embed = new EmbedBuilder(createInfoEmbed('You have already claimed this ticket.'));
      await message.reply({ embeds: [embed] });
      return;
    }
    ticketClaimMap.set(channel.id, member.id);

    const embed = new EmbedBuilder({
      color: COLOR,
      description: `This ticket has been claimed by ${member}.`,
      footer: { text: 'ModMail System' }
    });

    await message.reply({ embeds: [embed] });
  }

  if (command === 'unclaim') {
    const claimedBy = ticketClaimMap.get(channel.id);
    if (!claimedBy) {
      const embed = new EmbedBuilder(createInfoEmbed('This ticket is not claimed by anyone.'));
      await message.reply({ embeds: [embed] });
      return;
    }
    if (claimedBy !== member.id) {
      const embed = new EmbedBuilder(createInfoEmbed('Only the staff member who claimed this ticket can unclaim it.'));
      await message.reply({ embeds: [embed] });
      return;
    }
    ticketClaimMap.delete(channel.id);

    const embed = new EmbedBuilder({
      color: COLOR,
      description: `This ticket has been unclaimed by ${member}.`,
      footer: { text: 'ModMail System' }
    });

    await message.reply({ embeds: [embed] });
  }

  if (command === 'connect') {
    if (!user) {
      const embed = new EmbedBuilder(createInfoEmbed('No user is associated with this ticket.'));
      await message.reply({ embeds: [embed] });
      return;
    }

    const embedToUser = new EmbedBuilder({
      color: COLOR,
      title: 'Support Connected',
      description: 'A staff member has connected to your ticket and will assist you shortly.',
      footer: { text: 'ModMail System' }
    });

    await user.send({ embeds: [embedToUser] }).catch(() => {});

    const embedInTicket = new EmbedBuilder({
      color: COLOR,
      description: `${member} has connected to this ticket.`,
      footer: { text: 'ModMail System' }
    });

    await message.reply({ embeds: [embedInTicket] });
  }

  if (command === 'transfer') {
    const target = (args[0] || '').toLowerCase();
    if (!['gs', 'comm', 's', 'ls'].includes(target)) {
      const embed = new EmbedBuilder(createInfoEmbed('Invalid department. Use one of: `gs`, `comm`, `s`, `ls`.'));
      await message.reply({ embeds: [embed] });
      return;
    }

    const dept = DEPARTMENTS[target];
    ticketDepartmentMap.set(channel.id, dept.code);

    const overwrites = [
      {
        id: guild.roles.everyone,
        deny: [PermissionsBitField.Flags.ViewChannel]
      },
      {
        id: client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ManageMessages
        ]
      }
    ];

    if (dept.code !== 'ls') {
      [GS_ROLE_ID, COMM_ROLE_ID, S_ROLE_ID, LS_ROLE_ID].forEach(roleId => {
        if (!roleId) return;
        overwrites.push({
          id: roleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        });
      });
    } else {
      if (LS_ROLE_ID) {
        overwrites.push({
          id: LS_ROLE_ID,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory
          ]
        });
      }
    }

    await channel.edit({
      permissionOverwrites: overwrites
    });

    const newName = `ticket-${dept.code}-${channel.name.split('-').slice(2).join('-') || 'ticket'}`;
    await channel.setName(newName).catch(() => {});

    const embed = new EmbedBuilder({
      color: COLOR,
      description: `This ticket has been transferred to **${dept.name}** by ${member}.`,
      footer: { text: 'ModMail System' }
    });

    const pingText = dept.roleId ? `<@&${dept.roleId}>` : '';

    await channel.send({
      content: pingText || null,
      embeds: [embed]
    });

    await message.delete().catch(() => {});
  }
}

client.login(process.env.TOKEN);

// --- EXPRESS KEEP-ALIVE SERVER ---
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("Bot is running"));
app.listen(process.env.PORT || 3000, () =>
  console.log("Express keep-alive server is online.")
);
// ---------------------------------
