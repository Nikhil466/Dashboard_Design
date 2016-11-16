CREATE TABLE [RuleEngine].[RuleSubscribers]
(
	[RuleId] INT NOT NULL,
	[Subscriber] NVARCHAR(250) NOT NULL,
	CONSTRAINT PK__RuleSubscribers__RuleId_Subscriber PRIMARY KEY CLUSTERED ([RuleId], [Subscriber]),
	CONSTRAINT FK__RuleSubscribers__RuleId FOREIGN KEY ([RuleId]) REFERENCES [RuleEngine].[Rules] ([Id])
)