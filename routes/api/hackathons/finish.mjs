import auth from '../../../libs/auth';
import { asyncWrapper } from '../../../libs/utils';
import { getActiveHackathon, finishHackathon } from '../../../models/helpers';

async function finish(req, res) {
  const { cookies : { token }, body } = req;
  const role = await auth.getRoleByToken(token);

  if (!role) {
    res.status(401).send({ errorMessage: 'Authentication failed.' });
  } else if (!role.isAdmin) {
    res.status(403).send({ errorMessage: 'You don\'t have permission' });
  } else {
    const activeHackathon =  await getActiveHackathon();
    if (!activeHackathon) {
      res.status(422).send({ errorMessage: 'No active hackaton.' });
    } else if (activeHackathon.finished) {
      res.status(422).send({ errorMessage: 'Hackathon has already finished.' });
    } else if (!activeHackathon.started) {
      res.status(422).send({ errorMessage: 'Hackathon hasn\'t yet started.' });
    } else {
      const { finished } = await finishHackathon();
      res.send({ finished });
    }
  }
}

export default asyncWrapper(finish);