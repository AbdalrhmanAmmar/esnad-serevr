import VisitModel from "../../modals/clincs/VisitSchema.model";

export const createVisit = async (req, res) => {
  try {
    const {
      visitDate,
      doctor,
      clinic,
      items,
      supervisorPresent,
      notes
    } = req.body;

    const createdBy = req.user._id; // لو عندك auth middleware

    const visit = await VisitModel.create({
      visitDate,
      doctor,
      clinic,
      items,
      supervisorPresent,
      notes,
      createdBy
    });

    res.status(201).json({ success: true, data: visit });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
