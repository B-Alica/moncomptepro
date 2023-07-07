import { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import {
  idSchema,
  optionalBooleanSchema,
} from '../../services/custom-zod-schemas';
import {
  sendOfficialContactEmailVerificationEmail,
  verifyOfficialContactEmailToken,
} from '../../managers/organization/official-contact-email-verification';
import getNotificationsFromRequest from '../../services/get-notifications-from-request';
import {
  ApiAnnuaireError,
  InvalidTokenError,
  OfficialContactEmailVerificationNotNeededError,
} from '../../errors';

export const getOfficialContactEmailVerificationController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schema = z.object({
      query: z.object({
        new_code_sent: optionalBooleanSchema(),
      }),
      params: z.object({
        organization_id: idSchema(),
      }),
    });

    const {
      query: { new_code_sent },
      params: { organization_id },
    } = await schema.parseAsync({
      query: req.query,
      params: req.params,
    });

    const {
      codeSent,
      contactEmail,
      libelle,
    } = await sendOfficialContactEmailVerificationEmail({
      user_id: req.session.user!.id,
      organization_id,
      checkBeforeSend: true,
    });

    return res.render('user/official-contact-email-verification', {
      notifications: await getNotificationsFromRequest(req),
      contactEmail,
      csrfToken: req.csrfToken(),
      newCodeSent: new_code_sent,
      codeSent,
      libelle,
    });
  } catch (error) {
    if (error instanceof OfficialContactEmailVerificationNotNeededError) {
      return res.redirect(
        `/users/join-organization?notification=official_contact_email_verification_not_needed`
      );
    }

    if (error instanceof ApiAnnuaireError) {
      return res.redirect(
        `/users/join-organization?notification=api_annuaire_error`
      );
    }

    next(error);
  }
};

export const postOfficialContactEmailVerificationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schema = z.object({
      body: z.object({
        official_contact_email_verification_token: z.string().min(1),
      }),
      params: z.object({
        organization_id: idSchema(),
      }),
    });

    const {
      body: { official_contact_email_verification_token },
      params: { organization_id },
    } = await schema.parseAsync({
      body: req.body,
      params: req.params,
    });

    await verifyOfficialContactEmailToken({
      user_id: req.session.user!.id,
      organization_id,
      token: official_contact_email_verification_token,
    });

    return next();
  } catch (error) {
    if (
      req.params?.organization_id &&
      (error instanceof InvalidTokenError || error instanceof ZodError)
    ) {
      return res.redirect(
        `/users/official-contact-email-verification/${req.params.organization_id}?notification=invalid_verify_email_code`
      );
    }

    next(error);
  }
};
