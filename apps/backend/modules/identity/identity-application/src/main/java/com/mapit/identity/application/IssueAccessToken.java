package com.mapit.identity.application;

import org.springframework.stereotype.Service;

import com.mapit.identity.domain.AccessTokenIssuer;
import com.mapit.identity.domain.AuthenticatedUser;
import com.mapit.identity.domain.IssuedAccessToken;

/** MAP-47: emite un token para una identidad que MAP-46 ya verificó. */
@Service
public class IssueAccessToken {
    private final AccessTokenIssuer tokens;

    public IssueAccessToken(AccessTokenIssuer tokens) {
        this.tokens = tokens;
    }

    public IssuedAccessToken execute(AuthenticatedUser user) {
        return tokens.issue(user);
    }
}
