import fetch from 'node-fetch';

export default (router, { services, database }) => {
  const { ItemsService, UsersService } = services;

  router.post('/', async (req, res) => {
    const userId = req.accountability?.user;
    if (!userId) return res.status(401).json({ error: 'Non autorisé' });

    const usersService = new UsersService({ schema: req.schema });
    const user = await usersService.readOne(userId);
    const token = user.battlenet_token;
    if (!token) return res.status(400).json({ error: 'Token Battle.net manquant' });

    // 1. Récupérer la liste des personnages
    const summaryRes = await fetch('https://eu.api.blizzard.com/profile/user/wow', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Battlenet-Namespace': 'profile-eu',
        'Content-Type': 'application/json',
      },
    });

    const summary = await summaryRes.json();
    if (!summary.characters) {
      return res.status(400).json({ error: 'Aucun personnage trouvé', details: summary });
    }

    const characters = summary.characters;

    const characterService = new ItemsService('wow_characters', {
      schema: req.schema,
      accountability: req.accountability,
    });

    await characterService.deleteByQuery({ filter: { user: { _eq: userId } } });

    for (const char of characters) {
      await characterService.createOne({
        user: userId,
        name: char.name,
        level: char.level,
        realm: char.realm.name,
        class: char.playable_class.name,
        race: char.playable_race.name,
        date_updated: new Date().toISOString(),
      });
    }

    res.json({ success: true, count: characters.length });
  });
};
