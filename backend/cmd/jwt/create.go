package jwt

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"

	"github.com/gofrs/uuid"
	"github.com/spf13/cobra"
	"github.com/teamhanko/hanko/backend/config"
	"github.com/teamhanko/hanko/backend/crypto/jwk"
	"github.com/teamhanko/hanko/backend/dto"
	"github.com/teamhanko/hanko/backend/persistence"
	"github.com/teamhanko/hanko/backend/persistence/models"
	"github.com/teamhanko/hanko/backend/session"
)

func NewCreateCommand() *cobra.Command {
	var (
		configFile string
		pretty     bool
	)

	cmd := &cobra.Command{
		Use:   "create [user_id]",
		Short: "generate a JSON Web Token for a given user_id",
		Long:  ``,
		Args: func(cmd *cobra.Command, args []string) error {
			if len(args) < 1 {
				return errors.New("user_id required")
			}
			if _, err := uuid.FromString(args[0]); err != nil {
				return errors.New("user_id is not a uuid")
			}
			return nil
		},
		Run: func(cmd *cobra.Command, args []string) {
			cfg, err := config.Load(&configFile)
			if err != nil {
				log.Fatal(err)
			}
			persister, err := persistence.New(cfg.Database)
			if err != nil {
				log.Fatal(err)
			}
			jwkPersister := persister.GetJwkPersister()
			jwkManager, err := jwk.NewDefaultManager(cfg.Secrets.Keys, jwkPersister)
			if err != nil {
				fmt.Printf("failed to create jwk persister: %s", err)
				return
			}

			sessionManager, err := session.NewManager(jwkManager, *cfg)
			if err != nil {
				fmt.Printf("failed to create session generator: %s", err)
				return
			}

			userId := uuid.FromStringOrNil(args[0])

			userModel, err := persister.GetUserPersister().Get(userId)
			if err != nil {
				fmt.Printf("failed to get user from db: %s", err)
				return
			}

			token, rawToken, err := sessionManager.GenerateJWT(dto.UserJWTFromUserModel(userModel))
			if err != nil {
				fmt.Printf("failed to generate token: %s", err)
				return
			}

			sessionID, _ := rawToken.Get("session_id")

			expirationTime := rawToken.Expiration()
			sessionModel := models.Session{
				ID:        uuid.FromStringOrNil(sessionID.(string)),
				UserID:    userId,
				CreatedAt: rawToken.IssuedAt(),
				UpdatedAt: rawToken.IssuedAt(),
				ExpiresAt: &expirationTime,
				LastUsed:  rawToken.IssuedAt(),
			}

			err = persister.GetSessionPersister().Create(sessionModel)
			if err != nil {
				fmt.Printf("failed to store session: %s", err)
				return
			}

			fmt.Printf("Token: %s\n", token)

			if pretty {
				rawTokenMap, err := rawToken.AsMap(context.Background())
				if err != nil {
					fmt.Println("failed to get JWT payload as map:", err)
					return
				}
				payloadJSON, err := json.MarshalIndent(rawTokenMap, "", "  ")
				if err != nil {
					fmt.Println("failed to marshal JWT payload as JSON:", err)
				}
				fmt.Printf("JWT payload: %s\n", string(payloadJSON))
			}
		},
	}

	cmd.Flags().StringVar(&configFile, "config", "", "config file")
	cmd.Flags().BoolVar(&pretty, "pretty", true, "pretty print the JWT payload")

	return cmd
}
