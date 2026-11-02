const indexerService = require('../services/blockchainIndexerService');

const listTransactions = async (req, res, next) => {
  try {
    const events = await indexerService.getEvents(req.query);
    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (err) {
    next(err);
  }
};

const indexEvent = async (req, res, next) => {
  try {
    const indexed = await indexerService.indexEvent(req.body);
    res.status(201).json({
      success: true,
      message: 'Blockchain event indexed successfully.',
      data: indexed
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listTransactions,
  indexEvent
};
